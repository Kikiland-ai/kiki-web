"""Public concept-media DTOs: per-placard/language narration and allowlisted teaching scenes.

A manifest is immutable and bound to one catalog version. It only describes media that was
prepared ahead of time; reading it never generates anything.
"""

import math
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .cam_canvas import ConceptCanvasArtifact
from .models import WireModel

SHA256 = r"^[a-f0-9]{64}$"
CATALOG_VERSION = r"^am-[a-f0-9]{24}$"
MEDIA_REVISION = r"^cm-[a-f0-9]{24}$"
Check = Literal["pending", "accepted", "rejected"]


class MediaSource(WireModel):
    origin: str
    label: str
    url: str | None = None


class SpeechModel(WireModel):
    """Model revision of a clip: what produced the speech, never a secret or request body."""

    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    voice: str = Field(min_length=1)
    style: str = Field(min_length=1)
    generator: str = Field(min_length=1)
    generatedAt: str = Field(min_length=1)


class ClipTiming(WireModel):
    # Only the clip's own duration is known. Sentence timestamps arrive with evaluated
    # alignment as a new kind; none are invented here.
    kind: Literal["clip_duration_only"]
    alignment: Literal["not_performed"]


class NarrationReview(WireModel):
    status: Literal["unreviewed", "reviewed"]
    pronunciation: Check
    nativeOdia: Check
    spokenFidelity: Check
    audioQuality: Check

    @model_validator(mode="after")
    def reviewed_only_when_accepted(self):
        checks = [self.pronunciation, self.nativeOdia, self.spokenFidelity, self.audioQuality]
        if (self.status == "reviewed") != all(c == "accepted" for c in checks):
            raise ValueError("Reviewed narration needs every check accepted")
        return self


class NarrationAudio(WireModel):
    lang: Literal["en", "or"]
    assetId: str = Field(pattern=SHA256)
    mimeType: Literal["audio/wav"]
    bytes: int = Field(gt=44, le=20_000_000)
    durationSeconds: float = Field(gt=0, le=600)
    sourceTextSha256: str = Field(pattern=SHA256)
    speechScriptSha256: str = Field(pattern=SHA256)
    audioSha256: str = Field(pattern=SHA256)
    narrationKind: Literal["generated", "recorded"]
    speech: SpeechModel
    timing: ClipTiming
    review: NarrationReview

    @model_validator(mode="after")
    def content_addressed(self):
        if self.assetId != self.audioSha256:
            raise ValueError("Audio must be content-addressed")
        return self


class NarrationRendition(NarrationAudio):
    renditionId: str = Field(pattern=r"^[A-Za-z0-9-]{1,96}\.(en|or)$")
    placardId: str = Field(min_length=1, max_length=96)

    @model_validator(mode="after")
    def identity(self):
        if self.renditionId != f"{self.placardId}.{self.lang}":
            raise ValueError("Rendition identity must follow placard and language")
        return self


class ConceptNarrationRendition(NarrationAudio):
    scope: Literal["concept"]
    conceptId: str = Field(pattern=r"^C-AM-(0[1-9]|10)$")
    renditionId: str = Field(pattern=r"^C-AM-(0[1-9]|10)\.concept\.(en|or)$")
    placardIds: list[str] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def identity(self):
        if self.renditionId != f"{self.conceptId}.concept.{self.lang}" or len(
            set(self.placardIds)
        ) != len(self.placardIds):
            raise ValueError("Concept audio identity/coverage is invalid")
        return self


class SceneControl(WireModel):
    name: str = Field(pattern=r"^[a-z][a-zA-Z0-9]{0,31}$")
    label: str = Field(min_length=1)
    unit: Literal["degree"]
    min: float
    max: float
    step: float = Field(gt=0)
    default: float

    @model_validator(mode="after")
    def bounded(self):
        steps = (self.max - self.min) / self.step
        if not self.min <= self.default <= self.max or abs(steps - round(steps)) > 1e-9:
            raise ValueError("Control default and step must sit inside its bounds")
        return self


class SceneOutput(WireModel):
    name: str = Field(pattern=r"^[a-z][a-zA-Z0-9]{0,31}$")
    label: str = Field(min_length=1)
    unit: Literal["dimensionless"]


class BehaviorTest(WireModel):
    """A renderer must reproduce these values before it may draw the scene."""

    inputs: dict[str, float]
    output: str
    expected: float
    tolerance: float = Field(gt=0, le=0.01)


class SourceBinding(WireModel):
    path: str = Field(min_length=1)
    sha256: str = Field(pattern=SHA256)


class SceneReview(WireModel):
    scientific: Check


class PhaseRecoveryScene(WireModel):
    artifactId: str = Field(pattern=r"^[A-Za-z0-9-]{1,96}$")
    renderer: Literal["coherent-phase-recovery/v1"]
    placardIds: list[str] = Field(min_length=1, max_length=4)
    prompt: str = Field(min_length=1)
    controls: list[SceneControl] = Field(min_length=1, max_length=1)
    outputs: list[SceneOutput] = Field(min_length=1, max_length=1)
    comparisonDegrees: list[float] = Field(min_length=1, max_length=6)
    # The authored brief labels the finite-filter residual separately from the ideal
    # prediction; this scene has no filter model, so it says so instead of drawing one.
    residual: Literal["not_modelled"]
    claim: Literal["ideal_teaching_model"]
    sources: list[MediaSource]
    bindings: list[SourceBinding] = Field(min_length=1)
    behaviorTests: list[BehaviorTest] = Field(min_length=1)
    review: SceneReview

    @model_validator(mode="after")
    def consistent(self):
        control, output = self.controls[0], self.outputs[0]
        if len(set(self.placardIds)) != len(self.placardIds) or any(
            not control.min <= d <= control.max for d in self.comparisonDegrees
        ):
            raise ValueError("Scene slots or comparisons are invalid")
        for test in self.behaviorTests:
            phi = test.inputs.get(control.name)
            if set(test.inputs) != {control.name} or test.output != output.name or phi is None:
                raise ValueError("Behavior tests must use the scene's control and output")
            if abs(math.cos(math.radians(phi)) - test.expected) > test.tolerance:
                raise ValueError("Behavior test disagrees with the phase-recovery model")
        return self


class MediaManifest(WireModel):
    schema_: Literal["concept-media-manifest/v1"] = Field(alias="schema")
    planId: Literal["LP-ANALOG-MODULATION"]
    conceptId: str = Field(pattern=r"^C-AM-(0[1-9]|10)$")
    catalogVersion: str = Field(pattern=CATALOG_VERSION)
    mediaRevision: str = Field(pattern=MEDIA_REVISION)
    release: Literal["sample_unreviewed", "reviewed"]
    narration: list[NarrationRendition | ConceptNarrationRendition]
    artifacts: list[
        Annotated[PhaseRecoveryScene | ConceptCanvasArtifact, Field(discriminator="renderer")]
    ]

    @model_validator(mode="after")
    def unique(self):
        ids = [r.renditionId for r in self.narration]
        if len(set(ids)) != len(ids) or len({a.artifactId for a in self.artifacts}) != len(
            self.artifacts
        ):
            raise ValueError("Duplicate rendition or artifact")
        if self.release == "reviewed" and (
            any(r.review.status != "reviewed" for r in self.narration)
            or any(a.review.scientific != "accepted" for a in self.artifacts)
        ):
            raise ValueError("A reviewed release cannot carry unreviewed media")
        return self


class MediaNarrationRef(WireModel):
    placardId: str
    lang: Literal["en", "or"]


class ConceptNarrationRef(WireModel):
    scope: Literal["concept"]
    conceptId: str
    placardIds: list[str]
    lang: Literal["en", "or"]


class MediaArtifactRef(WireModel):
    artifactId: str
    renderer: str
    placardIds: list[str]


class MediaExperience(WireModel):
    """Small lesson-side pointer to the published manifest; text stays complete without it."""

    schema_: Literal["media-experience/v1"] = Field(alias="schema")
    catalogVersion: str = Field(pattern=CATALOG_VERSION)
    mediaRevision: str = Field(pattern=MEDIA_REVISION)
    release: Literal["sample_unreviewed", "reviewed"]
    audioAvailable: bool = True
    narration: list[MediaNarrationRef | ConceptNarrationRef]
    artifacts: list[MediaArtifactRef]


class MediaManifestEnvelope(WireModel):
    manifest: MediaManifest


def experience(manifest: MediaManifest, audio_available=True) -> MediaExperience:
    return MediaExperience(
        schema="media-experience/v1",
        catalogVersion=manifest.catalogVersion,
        mediaRevision=manifest.mediaRevision,
        release=manifest.release,
        **({"audioAvailable": False} if not audio_available else {}),
        narration=[
            {
                "scope": "concept",
                "conceptId": r.conceptId,
                "placardIds": r.placardIds,
                "lang": r.lang,
            }
            if isinstance(r, ConceptNarrationRendition)
            else {"placardId": r.placardId, "lang": r.lang}
            for r in manifest.narration
        ],
        artifacts=[
            {"artifactId": a.artifactId, "renderer": a.renderer, "placardIds": a.placardIds}
            for a in manifest.artifacts
        ],
    )
