"""Prepared C-AM-08 media over the test doubles: package binding, publication, private reads."""

import hashlib
import json
import shutil
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from test_learning import ROOT, Store, transactional
from test_profiles import FirestoreProfiles, Services, TestVerifier, bootstrap, headers

from kiki_api.backend import BoundaryError
from kiki_api.concept_media import (
    ConceptMedia,
    MemoryMediaAssets,
    asset_path,
    build_package,
    head_path,
    project_phase_recovery,
    publish,
)
from kiki_api.config import Settings
from kiki_api.learning import FirestoreLearning
from kiki_api.learning_catalog import build_catalog, import_catalog
from kiki_api.learning_models import PLAN, Lesson
from kiki_api.main import create_app

PACKAGE = ROOT / "data-model/media/C-AM-08"
VERSION = "am-51187527300cba2fa3cca868"


@pytest.fixture
def catalog():
    return build_catalog(
        ROOT / "data-model/ledgers/electronics/analog-modulation.json",
        ROOT / "data-model/cases/analog-modulation-odia.json",
    )


def concept(catalog, concept_id="C-AM-08"):
    base = f"learningCatalog/{PLAN}/versions/{catalog.version}"
    return (
        Lesson.model_validate(catalog.documents[f"{base}/lessons/{concept_id}"]),
        deepcopy(catalog.documents[f"{base}/sourceConcepts/{concept_id}"]),
    )


@pytest.fixture
def package(catalog):
    lesson, source = concept(catalog)
    return build_package(lesson, source, catalog.version, PACKAGE)


@pytest.fixture
def harness(monkeypatch, catalog):
    monkeypatch.setattr("kiki_api.learning.firestore.transactional", transactional)
    monkeypatch.setattr("kiki_api.concept_media.firestore.transactional", transactional)
    store, assets = Store(), MemoryMediaAssets()
    import_catalog(store, catalog)
    profiles = FirestoreProfiles(store)
    learning = FirestoreLearning(store, profiles, ConceptMedia(store, assets))
    services = Services(TestVerifier(), profiles, learning=learning)
    settings = Settings(_env_file=None, firebase_project_id="unit-test-project")
    client = TestClient(create_app(settings, lambda: services), raise_server_exceptions=False)
    for user in ["a", "b"]:
        bootstrap(client, user)
    response = client.post(
        "/learners/me/enrollments",
        headers=headers("a"),
        json={"courseId": "CRS-AC-ECE", "semester": 5},
    )
    assert response.status_code == 200
    return client, store, assets, learning


def test_package_binds_existing_clips_to_exact_text_scripts_and_audio(package, catalog):
    manifest = package.manifest
    lesson, _ = concept(catalog)
    assert catalog.version == VERSION
    assert manifest.catalogVersion == VERSION
    assert manifest.release == "sample_unreviewed"
    assert {(r.placardId, r.lang) for r in manifest.narration} == {
        (p.id, lang) for p in lesson.placards for lang in ["en", "or"]
    }
    provenance = json.loads((PACKAGE / "narration.provenance.json").read_text(encoding="utf-8"))
    for clip, rendition in zip(provenance["clips"], manifest.narration, strict=True):
        body = next(p.body for p in lesson.placards if p.id == clip["placardId"])
        text = body.en if clip["lang"] == "en" else body.or_
        content = (PACKAGE / clip["file"]).read_bytes()
        assert rendition.sourceTextSha256 == hashlib.sha256(text.encode()).hexdigest()
        assert (
            rendition.speechScriptSha256
            == hashlib.sha256(clip["speech_script"].encode()).hexdigest()
        )
        assert rendition.assetId == rendition.audioSha256 == hashlib.sha256(content).hexdigest()
        assert package.assets[rendition.assetId] == content
        assert rendition.durationSeconds == clip["audio"]["duration_seconds"]
        assert rendition.timing.kind == "clip_duration_only"
        assert rendition.review.status == "unreviewed"
        assert rendition.review.audioQuality == "pending"
    # Firestore keeps metadata only; the bytes live under content-addressed object paths.
    assert len(json.dumps(package.record)) < 50_000
    assert all(m["path"] == asset_path(a) for a, m in package.record["assets"].items())
    again = build_package(lesson, concept(catalog)[1], catalog.version, PACKAGE)
    assert again.manifest.mediaRevision == manifest.mediaRevision


def test_package_rejects_changed_text_audio_or_format(catalog, tmp_path):
    lesson, source = concept(catalog)
    folder = tmp_path / "C-AM-08"
    shutil.copytree(PACKAGE, folder)
    changed = lesson.model_copy(deep=True)
    changed.placards[1].body.en += " Changed."
    with pytest.raises(ValueError, match="no longer matches its placard text"):
        build_package(changed, source, catalog.version, folder)
    clip = folder / "CARD-AM-08-recap.en.wav"
    original = clip.read_bytes()
    clip.write_bytes(original[:-2] + b"\x01\x00")
    with pytest.raises(ValueError, match="does not match its provenance"):
        build_package(lesson, source, catalog.version, folder)
    clip.write_bytes(original[:22] + b"\x02" + original[23:])  # two channels
    with pytest.raises(ValueError, match="24 kHz mono"):
        build_package(lesson, source, catalog.version, folder)


def test_phase_scene_is_projected_from_authored_source_only(catalog):
    lesson, source = concept(catalog)
    scene = project_phase_recovery(source, ["CARD-AM-08-concept"])
    interactive = source["explanation"]["modalities"]["interactive"]
    control = scene.controls[0]
    assert (control.min, control.max, control.step, control.default) == (0, 180, 15, 60)
    assert control.unit == "degree" and scene.prompt == interactive["prompt"]
    assert {t.inputs["phi"]: t.expected for t in scene.behaviorTests} == {
        0: 1,
        60: 0.5,
        90: 0,
        180: -1,
    }
    assert scene.comparisonDegrees == [0, 60, 90]
    assert scene.residual == "not_modelled" and scene.claim == "ideal_teaching_model"
    for change, match in [
        (
            lambda s: s["explanation"]["modalities"]["interactive"]["inputs"][0].update(unit="rad"),
            "degrees",
        ),
        (
            lambda s: s["explanation"]["modalities"]["interactive"]["outputs"][0].update(
                formula="sin(phi)"
            ),
            "Unrecognised",
        ),
        (lambda s: s.update(id="C-AM-04"), "Unsupported"),
    ]:
        broken = deepcopy(source)
        change(broken)
        with pytest.raises(ValueError, match=match):
            project_phase_recovery(broken, ["CARD-AM-08-concept"])
    with pytest.raises(ValueError, match="Behavior test disagrees"):
        scene.model_validate(
            {
                **scene.model_dump(by_alias=True),
                "behaviorTests": [
                    {
                        "inputs": {"phi": 60},
                        "output": "fraction",
                        "expected": 0.6,
                        "tolerance": 1e-6,
                    }
                ],
            }
        )


def test_publication_is_atomic_idempotent_and_leaves_catalog_and_learners_alone(harness, package):
    client, store, assets, _ = harness
    response = client.put(
        "/learners/me/positions/C-AM-08", headers=headers(), json={"placardId": "CARD-AM-08-recap"}
    )
    assert response.status_code == 200
    before = deepcopy(store.docs)
    assert publish(store, assets, package) == "published"
    added = {k for k in store.docs if k not in before}
    head = head_path(VERSION, "C-AM-08")
    assert added == {head, f"{head}/revisions/{package.manifest.mediaRevision}"}
    assert all(store.docs[k] == v for k, v in before.items())
    assert set(assets.objects) == {asset_path(a) for a in package.assets}
    assert publish(store, assets, package) == "unchanged"
    # A different revision needs the current one named; nothing changes when it is not.
    other = deepcopy(package)
    other.manifest = other.manifest.model_copy(update={"mediaRevision": "cm-" + "1" * 24})
    snapshot = deepcopy(store.docs)
    with pytest.raises(BoundaryError) as error:
        publish(store, assets, other)
    assert error.value.status == 409 and store.docs == snapshot
    # Naming the current revision moves the head; republishing the earlier one rolls it back.
    current = package.manifest.mediaRevision
    assert publish(store, assets, other, expected_current=current) == "published"
    assert store.docs[head]["currentRevision"] == other.manifest.mediaRevision
    assert publish(store, assets, package, other.manifest.mediaRevision) == "published"
    assert store.docs[head]["currentRevision"] == current
    assert store.docs[f"{head}/revisions/{current}"] == package.record
    # Saved place survives: media is a separate revision, not a catalog reimport.
    progress = client.get(f"/learners/me/progress?planId={PLAN}", headers=headers()).json()
    c08 = next(c for c in progress["progress"]["concepts"] if c["conceptId"] == "C-AM-08")
    assert c08["position"]["placardId"] == "CARD-AM-08-recap"


def test_publication_needs_an_imported_catalog_version(harness, package):
    _, store, assets, _ = harness
    unbound = deepcopy(package)
    unbound.manifest = unbound.manifest.model_copy(update={"catalogVersion": "am-" + "2" * 24})
    with pytest.raises(BoundaryError) as error:
        publish(store, assets, unbound)
    assert error.value.status == 409 and not assets.objects


def test_lesson_points_to_published_media_without_generating_or_writing(harness, package):
    client, store, assets, _ = harness
    plain = client.get("/concepts/C-AM-08/lesson", headers=headers()).json()["lesson"]
    assert "mediaExperience" not in plain and plain["media"] == {"status": "none"}
    assert client.get("/concepts/C-AM-08/media", headers=headers()).status_code == 404
    publish(store, assets, package)
    before = deepcopy(store.docs)
    lesson = client.get("/concepts/C-AM-08/lesson", headers=headers()).json()["lesson"]
    pointer = lesson["mediaExperience"]
    assert pointer["mediaRevision"] == package.manifest.mediaRevision
    assert pointer["catalogVersion"] == VERSION
    assert len(pointer["narration"]) == 8
    assert pointer["artifacts"][0]["renderer"] == "coherent-phase-recovery/v1"
    assert {k: v for k, v in lesson.items() if k != "mediaExperience"} == plain
    other = client.get("/concepts/C-AM-04/lesson", headers=headers()).json()["lesson"]
    assert "mediaExperience" not in other and other["visual"]["schema"] == "dsb-sc-visual/v1"
    assert store.docs == before


def test_manifest_and_assets_are_owner_gated_private_and_verified(harness, package):
    client, store, assets, _ = harness
    publish(store, assets, package)
    manifest = client.get("/concepts/C-AM-08/media", headers=headers()).json()["manifest"]
    assert manifest["mediaRevision"] == package.manifest.mediaRevision
    assert "concept-media/" not in json.dumps(manifest) and "assets" not in manifest
    clip = manifest["narration"][0]
    url = f"/concepts/C-AM-08/media/{manifest['mediaRevision']}/assets/{clip['assetId']}"
    response = client.get(url, headers=headers())
    assert response.status_code == 200
    assert response.content == package.assets[clip["assetId"]]
    assert response.headers["content-type"] == "audio/wav"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert client.get(url).status_code == 401
    # b has a Google identity but no enrollment; neither the manifest nor bytes are served.
    assert client.get("/concepts/C-AM-08/media", headers=headers("b")).status_code == 403
    assert client.get(url, headers=headers("b")).status_code == 403
    assert client.get(url.replace(clip["assetId"], "0" * 64), headers=headers()).status_code == 404
    assert client.get(url.replace("/assets/", "/x/"), headers=headers()).status_code == 404
    assert client.get(url.replace(clip["assetId"], "../x"), headers=headers()).status_code in {
        404,
        422,
    }
    path = asset_path(clip["assetId"])
    content, mime = assets.objects[path]
    assets.objects[path] = (content[:-1] + b"\x00", mime)
    assert client.get(url, headers=headers()).status_code == 503


def test_stale_or_unconfigured_media_falls_back_to_text(harness, package, catalog):
    client, store, assets, learning = harness
    publish(store, assets, package)
    revision = f"{head_path(VERSION, 'C-AM-08')}/revisions/{package.manifest.mediaRevision}"
    record = store.docs[revision]
    record["manifest"]["narration"][0]["sourceTextSha256"] = "f" * 64
    lesson = client.get("/concepts/C-AM-08/lesson", headers=headers())
    assert lesson.status_code == 200 and "mediaExperience" not in lesson.json()["lesson"]
    assert client.get("/concepts/C-AM-08/media", headers=headers()).status_code == 503
    learning.media.assets = None
    assert client.get("/concepts/C-AM-08/media", headers=headers()).status_code == 503
    assert (
        "mediaExperience"
        not in client.get("/concepts/C-AM-08/lesson", headers=headers()).json()["lesson"]
    )


def test_missing_media_adapter_keeps_text_and_returns_unavailable(harness):
    client, _, _, learning = harness
    learning.media = None
    lesson = client.get("/concepts/C-AM-08/lesson", headers=headers())
    assert lesson.status_code == 200 and "mediaExperience" not in lesson.json()["lesson"]
    paths = [
        "/concepts/C-AM-08/media",
        f"/concepts/C-AM-08/media/cm-{'a' * 24}/assets/{'b' * 64}",
    ]
    for path in paths:
        assert client.get(path, headers=headers()).status_code == 503
        assert client.get(path, headers=headers("b")).status_code == 403


def test_media_contract_receipts_for_react(harness, package):
    client, store, assets, _ = harness
    publish(store, assets, package)
    data = {
        "mediaLesson": client.get("/concepts/C-AM-08/lesson", headers=headers()).json(),
        "mediaManifest": client.get("/concepts/C-AM-08/media", headers=headers()).json(),
    }
    folder = ROOT / "apps/api/test-artifacts"
    folder.mkdir(exist_ok=True)
    (folder / "media-contract.json").write_text(json.dumps(data, ensure_ascii=False))
