"""All ten transferred candidates: in-process private API/store doubles, zero cloud/provider."""

import hashlib
import json
from copy import deepcopy
from pathlib import Path

import pytest
from test_concept_media import catalog, concept, harness
from test_profiles import headers

from kiki_api.concept_media import ConceptMedia, MediaPackage, bind, inspect_wav, publish
from kiki_api.media_models import MediaManifest

__all__ = ["catalog", "harness"]
ROOT = Path(__file__).resolve().parents[3]
RECORDS = ROOT / "apps/web/src/fixtures/all-cam"
ASSETS = ROOT / "data-model/media/all-cam/assets"
IDS = [f"C-AM-{n:02d}" for n in range(1, 11)]


def package(cid, catalog):
    record = json.loads((RECORDS / f"{cid}.json").read_text())
    manifest = MediaManifest.model_validate(record["manifest"])
    lesson, source = concept(catalog, cid)
    bind(manifest, lesson, source)
    assets = {}
    for r in manifest.narration:
        data = (ASSETS / f"{r.assetId}.wav").read_bytes()
        assert len(data) == r.bytes and hashlib.sha256(data).hexdigest() == r.audioSha256
        duration, _ = inspect_wav(data)
        assert abs(duration - r.durationSeconds) < 0.01
        assets[r.assetId] = data
    return MediaPackage(manifest, record, assets)


@pytest.mark.parametrize("cid", IDS)
def test_all_candidates_bind_bytes_deliver_privately_and_keep_metadata_without_audio(
    cid, catalog, harness
):
    client, store, assets, learning = harness
    candidate = package(cid, catalog)
    assert publish(store, assets, candidate) == "published"
    path = f"/concepts/{cid}"
    pointer = client.get(path + "/lesson", headers=headers()).json()["lesson"]["mediaExperience"]
    assert len(pointer["artifacts"]) == 1
    assert len(pointer["narration"]) == len(candidate.manifest.narration)
    response = client.get(path + "/media", headers=headers())
    assert response.status_code == 200
    assert response.json()["manifest"] == candidate.record["manifest"]
    r = candidate.manifest.narration[0]
    asset_path = path + f"/media/{candidate.manifest.mediaRevision}/assets/{r.assetId}"
    assert client.get(asset_path).status_code == 401
    assert client.get(asset_path, headers=headers("b")).status_code == 403
    audio = client.get(asset_path, headers=headers())
    assert audio.status_code == 200 and hashlib.sha256(audio.content).hexdigest() == r.assetId
    assert audio.headers["cache-control"] == "private, no-store"
    for clip in candidate.manifest.narration:
        delivered = client.get(
            path + f"/media/{candidate.manifest.mediaRevision}/assets/{clip.assetId}",
            headers=headers(),
        )
        assert delivered.status_code == 200
        assert hashlib.sha256(delivered.content).hexdigest() == clip.assetId
    learning.media = ConceptMedia(store, None)
    saved = deepcopy(store.docs)
    lesson = client.get(path + "/lesson", headers=headers()).json()["lesson"]
    assert lesson["mediaExperience"]["audioAvailable"] is False
    assert len(lesson["mediaExperience"]["artifacts"]) == 1
    assert client.get(path + "/media", headers=headers()).status_code == 200
    assert client.get(asset_path, headers=headers()).status_code == 503
    assert store.docs == saved
    output = Path("test-artifacts") / f"all-cam-{cid}.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(
        json.dumps({"lesson": lesson, "manifest": response.json()["manifest"]}, ensure_ascii=False)
        + "\n",
        encoding="utf-8",
    )


@pytest.mark.parametrize("cid", ["C-AM-04", "C-AM-05", "C-AM-06", "C-AM-07", "C-AM-09", "C-AM-10"])
def test_concept_narration_rejects_reordered_partial_or_changed_text(cid, catalog):
    p = package(cid, catalog)
    lesson, source = concept(catalog, cid)
    for covered in [
        list(reversed(p.manifest.narration[0].placardIds)),
        p.manifest.narration[0].placardIds[:-1],
    ]:
        bad = p.manifest.model_copy(deep=True)
        bad.narration[0].placardIds = covered
        with pytest.raises(ValueError, match="ordered"):
            bind(bad, lesson, source)
    lesson.placards[2].body.or_ += " changed"
    with pytest.raises(ValueError, match="text"):
        bind(p.manifest, lesson, source)


def test_cam08_native_package_is_unchanged(catalog):
    p = package("C-AM-08", catalog)
    old = json.loads((ROOT / "apps/web/src/fixtures/concept-media-C-AM-08.json").read_text())
    assert p.record["manifest"] == old["manifest"]
    assert p.manifest.mediaRevision == "cm-e0f086007cc9f2062af093f3"
    assert len(p.manifest.narration) == 8


@pytest.mark.parametrize("field", ["model", "scene", "cases", "bounds"])
def test_canvas_rejects_changed_provenance_conformance_and_controls(field):
    record = json.loads((RECORDS / "C-AM-01.json").read_text())
    a = record["manifest"]["artifacts"][0]
    if field == "model":
        a["modelBindings"][0]["sha256"] = "0" * 64
    if field == "scene":
        a["modelBindings"][1]["sha256"] = "0" * 64
    if field == "cases":
        a["behaviorTests"][0]["samples"][0]["values"][0] = 42
    if field == "bounds":
        a["scene"]["controls"][0]["max"] = 99
    with pytest.raises(ValueError):
        MediaManifest.model_validate(record["manifest"])
