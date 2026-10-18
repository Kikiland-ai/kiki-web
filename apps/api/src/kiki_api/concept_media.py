"""Preprocessed concept media: source-bound packages, private assets, immutable publication.

Media revisions live beside the catalog, never inside its immutable version documents, so
publishing audio or scenes does not change the catalog version or any learner state.
"""

import hashlib
import json
import logging
import math
import re
import wave
from array import array
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Protocol

from firebase_admin import firestore
from google.api_core.exceptions import NotFound, PreconditionFailed
from pydantic import ValidationError

from .backend import BoundaryError
from .learning_catalog import digest, dump
from .learning_models import PLAN, Lesson
from .media_models import (
    MEDIA_REVISION,
    ConceptNarrationRendition,
    MediaExperience,
    MediaManifest,
    PhaseRecoveryScene,
    experience,
)

logger = logging.getLogger("kiki_api")
SAMPLE_RATE, CHANNELS, SAMPLE_WIDTH = 24_000, 1, 2


def sha256(content: bytes | str) -> str:
    return hashlib.sha256(content.encode() if isinstance(content, str) else content).hexdigest()


def head_path(catalog_version: str, concept_id: str) -> str:
    return f"conceptMedia/{PLAN}/catalogVersions/{catalog_version}/concepts/{concept_id}"


def asset_path(asset_id: str) -> str:
    # Content-addressed and immutable: a new revision never overwrites an earlier asset.
    return f"concept-media/{PLAN}/assets/sha256/{asset_id}"


def bind(manifest: MediaManifest, lesson: Lesson, source: dict | None = None):
    """Reject media that no longer matches the exact text or source it was prepared from."""
    cards = {p.id: p for p in lesson.placards}
    if manifest.conceptId != lesson.conceptId:
        raise ValueError("Media belongs to another concept")
    for clip in manifest.narration:
        if isinstance(clip, ConceptNarrationRendition):
            if clip.conceptId != lesson.conceptId or clip.placardIds != list(cards):
                raise ValueError("Concept narration must cover the exact ordered lesson placards")
            text = " ".join(
                getattr(cards[p].body, "or_" if clip.lang == "or" else "en")
                for p in clip.placardIds
            )
        else:
            card = cards.get(clip.placardId)
            if card is None:
                raise ValueError("Narration has an unknown placard")
            text = getattr(card.body, "or_" if clip.lang == "or" else "en")
        if sha256(text) != clip.sourceTextSha256:
            raise ValueError(f"Narration {clip.renditionId} no longer matches its placard text")
    for scene in manifest.artifacts:
        if scene.renderer == "cam-concept-canvas/v1":
            if scene.scene.conceptId != lesson.conceptId or scene.placardIds != card_ids(lesson):
                raise ValueError("Canvas identity or slots differ from lesson")
            if source is not None:
                modalities = source["explanation"]["modalities"]
                if (
                    scene.scene.sourceInteractive != modalities["interactive"]
                    or scene.scene.visualBrief.model_dump(by_alias=True)
                    != modalities["textImage"]["visual"]
                ):
                    raise ValueError("Canvas differs from authored source")
        if any(p not in cards for p in scene.placardIds):
            raise ValueError(f"Scene {scene.artifactId} is placed on an unknown placard")
        if source is not None and scene_bindings(source) != [dump(b) for b in scene.bindings]:
            raise ValueError(f"Scene {scene.artifactId} no longer matches its authored source")


def scene_bindings(source: dict) -> list[dict]:
    modalities = source["explanation"]["modalities"]
    return [
        {
            "path": f"sourceConcepts/{source['id']}#explanation.modalities.interactive",
            "sha256": digest(modalities["interactive"]),
        },
        {
            "path": f"sourceConcepts/{source['id']}#explanation.modalities.textImage.visual",
            "sha256": digest(modalities["textImage"]["visual"]),
        },
    ]


def project_phase_recovery(source: dict, placard_ids: list[str]) -> PhaseRecoveryScene:
    """Allowlisted projection of C-AM-08's authored phase sweep; the formula is never evaluated."""
    if source["id"] != "C-AM-08":
        raise ValueError("Unsupported scene source")
    modalities = source["explanation"]["modalities"]
    interactive, visual = modalities["interactive"], modalities["textImage"]["visual"]
    if interactive["kind"] != "parameter_sweep" or visual["kind"] != "waveform":
        raise ValueError("Unsupported interaction")
    [phi], [fraction] = interactive["inputs"], interactive["outputs"]
    if (phi["name"], phi["unit"]) != ("phi", "degree"):
        raise ValueError("Expected a phase error in degrees")
    if (fraction["name"], fraction["formula"]) != ("fraction", "cos(phi*pi/180)"):
        raise ValueError("Unrecognised recovery model")
    # The authored visual brief compares 0, 60 and 90 degree errors.
    comparison = [0, 60, 90]
    if any((d - phi["min"]) % phi["step"] for d in comparison):
        raise ValueError("Comparison phases are off the control's steps")
    return PhaseRecoveryScene(
        artifactId="SCENE-AM-08-phase-recovery",
        renderer="coherent-phase-recovery/v1",
        placardIds=placard_ids,
        prompt=interactive["prompt"],
        controls=[{k: phi[k] for k in ["name", "label", "unit", "min", "max", "step", "default"]}],
        outputs=[{k: fraction[k] for k in ["name", "label", "unit"]}],
        comparisonDegrees=comparison,
        residual="not_modelled",
        claim="ideal_teaching_model",
        sources=[visual["from"]],
        bindings=scene_bindings(source),
        behaviorTests=[
            {
                "inputs": {"phi": d},
                "output": "fraction",
                "expected": round(math.cos(math.radians(d)), 12),
                "tolerance": 1e-6,
            }
            for d in [0, 60, 90, 180]
        ],
        review={"scientific": "pending"},
    )


# Scene projectors by concept; each scene explains its own concept's authored interaction.
SCENES = {"C-AM-08": lambda source, lesson: [project_phase_recovery(source, card_ids(lesson))]}


def card_ids(lesson: Lesson) -> list[str]:
    return [p.id for p in lesson.placards if p.kind in {"concept", "application"}]


def inspect_wav(content: bytes) -> tuple[float, int]:
    try:
        with wave.open(BytesIO(content)) as clip:
            shape = (clip.getframerate(), clip.getnchannels(), clip.getsampwidth())
            frames = clip.getnframes()
            pcm = array("h", clip.readframes(frames))
    except (wave.Error, EOFError) as exc:
        raise ValueError("Unreadable WAV") from exc
    if shape != (SAMPLE_RATE, CHANNELS, SAMPLE_WIDTH) or not frames or len(pcm) != frames:
        raise ValueError("Expected complete 24 kHz mono 16-bit WAV")
    peak = max(abs(s) for s in pcm)
    if peak == 0:
        raise ValueError("Silent WAV")
    return frames / SAMPLE_RATE, peak


@dataclass
class MediaPackage:
    manifest: MediaManifest
    record: dict
    assets: dict[str, bytes]


def build_package(lesson: Lesson, source: dict, catalog_version: str, folder: Path):
    """Package existing clips/provenance for one concept. Nothing is generated here."""
    provenance = json.loads((folder / "narration.provenance.json").read_text(encoding="utf-8"))
    if provenance["schema"] != "kiki-web/narration-provenance/v1":
        raise ValueError("Unsupported provenance")
    renditions, assets = [], {}
    for clip in provenance["clips"]:
        if clip["conceptId"] != lesson.conceptId or "/" in clip["file"] or "\\" in clip["file"]:
            raise ValueError("Clip belongs to another concept or folder")
        content = (folder / clip["file"]).read_bytes()
        duration, peak = inspect_wav(content)
        audio = clip["audio"]
        if (
            sha256(content) != audio["sha256"]
            or len(content) != audio["bytes"]
            or abs(duration - audio["duration_seconds"]) > 0.01
            or peak != audio["peak_pcm"]
            or sha256(clip["speech_script"]) != clip["speech_script_sha256"]
            or clip["alignment_status"] != "not_performed"
            or clip["timing_cues"] is not None
        ):
            raise ValueError(f"{clip['file']} does not match its provenance")
        review = {
            "pronunciation": clip["review"]["pronunciation"],
            "nativeOdia": clip["review"]["native_Odia"],
            "spokenFidelity": clip["review"]["spoken_fidelity"],
            # Binary/audio-quality acceptance is a separate check nobody has recorded yet.
            "audioQuality": "pending",
        }
        renditions.append(
            {
                "renditionId": f"{clip['placardId']}.{clip['lang']}",
                "placardId": clip["placardId"],
                "lang": clip["lang"],
                "assetId": audio["sha256"],
                "mimeType": "audio/wav",
                "bytes": audio["bytes"],
                "durationSeconds": round(duration, 3),
                "sourceTextSha256": clip["display_text_sha256"],
                "speechScriptSha256": clip["speech_script_sha256"],
                "audioSha256": audio["sha256"],
                "narrationKind": "generated",
                "speech": {
                    "provider": provenance["provider"],
                    "model": clip["model"],
                    "voice": clip["voice"],
                    "style": clip["style"],
                    "generator": provenance["generator"],
                    "generatedAt": provenance["generated_at"],
                },
                "timing": {"kind": "clip_duration_only", "alignment": "not_performed"},
                "review": {
                    "status": "reviewed"
                    if all(v == "accepted" for v in review.values())
                    else "unreviewed",
                    **review,
                },
            }
        )
        assets[audio["sha256"]] = content
    artifacts = [dump(s) for s in SCENES.get(lesson.conceptId, lambda *_: [])(source, lesson)]
    body = {
        "schema": "concept-media-manifest/v1",
        "planId": PLAN,
        "conceptId": lesson.conceptId,
        "catalogVersion": catalog_version,
        "release": "sample_unreviewed",
        "narration": renditions,
        "artifacts": artifacts,
    }
    revision = "cm-" + digest({"projectionSchema": 1, "manifest": body})[:24]
    manifest = MediaManifest.model_validate({**body, "mediaRevision": revision})
    bind(manifest, lesson, source)
    record = {
        "schema": "concept-media-revision/v1",
        "manifest": dump(manifest),
        "assets": {
            r.assetId: {"path": asset_path(r.assetId), "mimeType": r.mimeType, "bytes": r.bytes}
            for r in manifest.narration
        },
    }
    return MediaPackage(manifest, record, assets)


class MediaAssets(Protocol):
    def put(self, path: str, content: bytes, mime: str, digest_: str) -> None: ...
    def read(self, path: str, mime: str, size: int, digest_: str) -> bytes: ...


class BucketMediaAssets:
    """Private object storage through the API's own identity; no public or signed URLs."""

    def __init__(self, bucket):
        self.bucket = bucket

    def put(self, path, content, mime, digest_):
        blob = self.bucket.blob(path)
        blob.metadata = {"sha256": digest_}
        blob.cache_control = "private, no-store"
        try:
            blob.upload_from_string(
                content, content_type=mime, if_generation_match=0, checksum="crc32c", timeout=60
            )
        except PreconditionFailed:
            blob.reload(timeout=10)
            if (blob.metadata or {}).get("sha256") != digest_ or blob.size != len(content):
                raise BoundaryError(409, "An existing media object has different bytes.") from None

    def read(self, path, mime, size, digest_):
        try:
            content = self.bucket.blob(path).download_as_bytes(checksum="crc32c", timeout=30)
        except NotFound:
            raise BoundaryError(503, "A published media file is missing.") from None
        if len(content) != size or sha256(content) != digest_:
            raise BoundaryError(503, "A media file could not be verified. Please retry.")
        return content


class MemoryMediaAssets:
    """Injected test store with the same create-only and verified-read behaviour."""

    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}

    def put(self, path, content, mime, digest_):
        saved = self.objects.setdefault(path, (content, mime))
        if saved != (content, mime) or sha256(content) != digest_:
            raise BoundaryError(409, "An existing media object has different bytes.")

    def read(self, path, mime, size, digest_):
        if path not in self.objects:
            raise BoundaryError(503, "A published media file is missing.")
        content, saved_mime = self.objects[path]
        if saved_mime != mime or len(content) != size or sha256(content) != digest_:
            raise BoundaryError(503, "A media file could not be verified. Please retry.")
        return content


def publish(client, assets: MediaAssets, package: MediaPackage, expected_current=None):
    """Upload immutable assets, then switch the concept's media head in one transaction."""
    manifest = package.manifest
    version_ref = client.document(f"learningCatalog/{PLAN}/versions/{manifest.catalogVersion}")
    if not version_ref.get(timeout=10).exists:
        raise BoundaryError(409, "Media must be bound to an imported catalog version.")
    for asset_id, meta in package.record["assets"].items():
        assets.put(meta["path"], package.assets[asset_id], meta["mimeType"], asset_id)
    head_ref = client.document(head_path(manifest.catalogVersion, manifest.conceptId))
    revision_ref = head_ref.collection("revisions").document(manifest.mediaRevision)

    @firestore.transactional
    def apply(transaction):
        head = head_ref.get(transaction=transaction, timeout=10)
        saved = revision_ref.get(transaction=transaction, timeout=10)
        current = head.to_dict().get("currentRevision") if head.exists else None
        if saved.exists and saved.to_dict() != package.record:
            raise BoundaryError(409, "An immutable media revision already has different content.")
        if current == manifest.mediaRevision and saved.exists:
            return "unchanged"
        if current != expected_current:
            raise BoundaryError(409, "Media changed. Inspect its revision before publishing.")
        if not saved.exists:
            transaction.create(revision_ref, package.record)
        transaction.set(
            head_ref,
            {
                "schema": "concept-media-head/v1",
                "conceptId": manifest.conceptId,
                "catalogVersion": manifest.catalogVersion,
                "currentRevision": manifest.mediaRevision,
            },
        )
        return "published"

    return apply(client.transaction(max_attempts=3))


class ConceptMedia:
    """Read-only delivery of published media. Nothing here prepares or generates media."""

    def __init__(self, client, assets: MediaAssets | None):
        self.client, self.assets = client, assets

    def _record(self, catalog_version, concept_id, revision=None):
        head_ref = self.client.document(head_path(catalog_version, concept_id))
        if revision is None:
            head = head_ref.get(timeout=5)
            if not head.exists:
                return None
            revision = head.to_dict().get("currentRevision")
        if not isinstance(revision, str) or not re.fullmatch(MEDIA_REVISION, revision):
            raise BoundaryError(404, "This media revision was not found.")
        snapshot = head_ref.collection("revisions").document(revision).get(timeout=5)
        if not snapshot.exists:
            raise BoundaryError(404, "This media revision was not found.")
        record = snapshot.to_dict()
        manifest = MediaManifest.model_validate(record["manifest"])
        if (
            record.get("schema") != "concept-media-revision/v1"
            or manifest.catalogVersion != catalog_version
            or manifest.conceptId != concept_id
            or manifest.mediaRevision != revision
            or set(record["assets"]) != {r.assetId for r in manifest.narration}
        ):
            raise BoundaryError(503, "The lesson media needs a compatibility check.")
        for rendition in manifest.narration:
            meta = record["assets"][rendition.assetId]
            if meta != {
                "path": asset_path(rendition.assetId),
                "mimeType": rendition.mimeType,
                "bytes": rendition.bytes,
            }:
                raise BoundaryError(503, "The media asset index needs a compatibility check.")
        return manifest, record

    def experience(self, catalog_version, lesson: Lesson) -> MediaExperience | None:
        # Published metadata is independent of private audio storage.
        try:
            found = self._record(catalog_version, lesson.conceptId)
            if found is None:
                return None
            bind(found[0], lesson)
            return experience(found[0], audio_available=self.assets is not None)
        except (BoundaryError, ValidationError, ValueError, KeyError) as exc:
            logger.warning("Lesson media omitted (%s)", type(exc).__name__)
            return None

    def manifest(self, catalog_version, lesson: Lesson, source: dict) -> MediaManifest:
        found = self._compatible(catalog_version, lesson, source)
        if found is None:
            raise BoundaryError(404, "No media has been published for this lesson.")
        return found[0]

    def asset(self, catalog_version, lesson: Lesson, source: dict, revision, asset_id):
        if self.assets is None:
            raise BoundaryError(503, "Lesson media storage is not available yet.")
        manifest, record = self._compatible(catalog_version, lesson, source, revision)
        meta = record["assets"].get(asset_id)
        if meta is None:
            raise BoundaryError(404, "This media file was not found.")
        if meta["path"] != asset_path(asset_id):
            raise BoundaryError(503, "The lesson media needs a compatibility check.")
        return self.assets.read(meta["path"], meta["mimeType"], meta["bytes"], asset_id), meta

    def _compatible(self, catalog_version, lesson, source, revision=None):
        try:
            found = self._record(catalog_version, lesson.conceptId, revision)
            if found is None:
                return None
            bind(found[0], lesson, source)
            return found
        except (ValidationError, ValueError, KeyError) as exc:
            logger.warning("Lesson media rejected (%s)", type(exc).__name__)
            raise BoundaryError(503, "The lesson media needs a compatibility check.") from None
