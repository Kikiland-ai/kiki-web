"""Preparation persists reports only, never trusted lab assessment or pointer state."""

import json
from copy import deepcopy
from hashlib import sha256

import pytest
from fastapi.testclient import TestClient
from test_learning import ROOT, Store, catalog, transactional
from test_profiles import TestVerifier, bootstrap, headers

from kiki_api.backend import FirestoreProfiles, Services
from kiki_api.concept_media import MemoryMediaAssets
from kiki_api.config import Settings
from kiki_api.lab_narration import MIME, LabNarration, release, storage_prefix
from kiki_api.lab_preparation import LabPreparations
from kiki_api.learning import FirestoreLearning
from kiki_api.learning_catalog import import_catalog
from kiki_api.learning_models import LAB_CONCEPTS, PLAN
from kiki_api.main import create_app

# Reuse the authored catalog fixture, not any synthetic learner or cloud credentials.
__all__ = ["catalog"]


@pytest.fixture
def lab_harness(monkeypatch, catalog):
    monkeypatch.setattr("kiki_api.lab_preparation.firestore.transactional", transactional)
    store = Store()
    import_catalog(store, catalog)
    profiles = FirestoreProfiles(store)
    learning = FirestoreLearning(store, profiles)
    service = LabPreparations(learning)
    services = Services(TestVerifier(), profiles, learning=learning, lab_preparations=service)
    client = TestClient(
        create_app(
            Settings(_env_file=None, firebase_project_id="unit-test-project"), lambda: services
        ),
        raise_server_exceptions=False,
    )
    for user in ["a", "b"]:
        bootstrap(client, user)
        client.post(
            "/learners/me/enrollments",
            headers=headers(user),
            json={"courseId": "CRS-AC-ECE", "semester": 3},
        )
    return client, store, catalog


def start(client, user="a"):
    response = client.post(
        "/lab-preparations", headers=headers(user), json={"practicalId": "PR-AM-DSB"}
    )
    assert response.status_code == 200, response.text
    return response.json()["preparation"]


def draft(session, **changes):
    return {
        "expectedRevision": session["revision"],
        "currentCheckpointId": session["currentCheckpointId"],
        "prediction": session["prediction"],
        "projectRef": session["projectRef"],
        "observationNotes": session["observationNotes"],
        **changes,
    }


def test_narration_uses_owned_preparation_and_verified_private_bytes(lab_harness, monkeypatch):
    old_client, store, _ = lab_harness
    assert len(release()["clips"]) == 40
    prep_id = start(old_client)["id"]
    root = f"/lab-preparations/{prep_id}/narration"
    assert old_client.get(root, headers=headers()).status_code == 404
    audio = b"test private audio bytes"
    asset_id = sha256(audio).hexdigest()
    revision = "b" * 64
    index = {
        **release(),
        "revision": revision,
        "clips": {"CP-DSB-01/create": {"assetId": asset_id, "bytes": len(audio)}},
    }
    monkeypatch.setattr("kiki_api.lab_narration.release", lambda: index)
    path = f"{storage_prefix(revision)}/assets/{asset_id}.wav"
    assets = MemoryMediaAssets()
    assets.put(path, audio, MIME, asset_id)
    profiles = FirestoreProfiles(store)
    prep = LabPreparations(FirestoreLearning(store, profiles))
    services = Services(
        TestVerifier(), profiles, lab_preparations=prep, lab_narration=LabNarration(assets)
    )
    settings = Settings(_env_file=None, firebase_project_id="unit-test-project")
    client = TestClient(create_app(settings, lambda: services))
    clip_url = f"{root}/{revision}/assets/{asset_id}"
    assert client.get(root).status_code == client.get(clip_url).status_code == 401
    assert client.get(root, headers=headers("b")).status_code == 404
    assert client.get(clip_url, headers=headers("b")).status_code == 404
    store.docs["learners/b"]["courseIds"] = []
    assert client.get(root, headers=headers("b")).status_code == 403
    manifest = client.get(root, headers=headers())
    assert manifest.json() == index and manifest.headers["cache-control"] == "private, no-store"
    assert client.get(f"{root}/{revision}/assets/{'a' * 64}", headers=headers()).status_code == 404
    response = client.get(clip_url, headers=headers())
    assert response.content == audio and response.headers["content-type"] == MIME
    assert response.headers["cache-control"] == "private, no-store"
    assets.objects[path] = (b"changed", MIME)
    assert client.get(clip_url, headers=headers()).status_code == 503


def test_practical_and_active_require_identity_enrollment_and_known_case(lab_harness):
    client, store, _ = lab_harness
    assert client.get("/practicals/PR-AM-DSB").status_code == 401
    store.docs["learners/b"]["courseIds"] = []
    assert client.get("/practicals/PR-AM-DSB", headers=headers("b")).status_code == 403
    assert client.get("/practicals/unknown", headers=headers()).status_code == 404
    response = client.get("/practicals/PR-AM-DSB", headers=headers())
    assert response.status_code == 200
    public = response.json()["practical"]
    assert len(public["checkpoints"]) == 12 and public["reviewStatus"] == "draft"
    assert "viva" not in public and "faultConfigurations" not in public
    assert client.get(
        "/lab-preparations/active?practicalId=PR-AM-DSB", headers=headers()
    ).json() == {"preparation": None}


def test_preparation_repeat_safe_before_prerequisites_and_always_unassessed(lab_harness):
    client, store, _ = lab_harness
    before = deepcopy(store.docs["learners/a"])
    session = start(client)
    assert start(client) == session
    assert session["readiness"]["missingConceptIds"] == LAB_CONCEPTS
    assert session["monitoring"] == {
        "status": "pending_integration",
        "pointerActive": False,
        "assessmentStatus": "not_assessed",
    }
    assert session["sessionPath"] == "/labs/" + session["id"]
    assert store.docs["learners/a"] == before
    assert len([p for p in store.docs if p.startswith("learners/a/labPreparations/")]) == 1


def test_saved_draft_cursor_observations_resume_without_learning_evidence(lab_harness):
    client, store, _ = lab_harness
    session = start(client)
    path = "/lab-preparations/" + session["id"]
    body = draft(
        session,
        currentCheckpointId="CP-DSB-03",
        prediction="Expect two sidebands.",
        projectRef="MySavedModel.slx",
        observationNotes={"0": "I have not run the model yet."},
    )
    saved = client.patch(path, headers=headers(), json=body)
    assert saved.status_code == 200, saved.text
    record = saved.json()["preparation"]
    assert record["revision"] == 1 and record["prediction"] == body["prediction"]
    assert record["currentCheckpointId"] == "CP-DSB-03"
    assert client.patch(path, headers=headers(), json=body).json() == saved.json()
    assert client.get(path, headers=headers()).json() == saved.json()
    assert (
        client.get("/lab-preparations/active?practicalId=PR-AM-DSB", headers=headers()).json()
        == saved.json()
    )
    assert not any("/learningStates/" in p or "/assessmentRuns/" in p for p in store.docs)
    assert record["monitoring"]["pointerActive"] is False


def test_links_and_writes_are_owned_and_forged_fields_rejected(lab_harness):
    client, _, _ = lab_harness
    session = start(client)
    path = "/lab-preparations/" + session["id"]
    assert client.get(path, headers=headers("b")).status_code == 404
    assert client.patch(path, headers=headers("b"), json=draft(session)).status_code == 404
    for field, value in [
        ("ownerLearnerId", "b"),
        ("monitoring", {"pointerActive": True}),
        ("completed", True),
        ("verifiedCheckpointIds", ["CP-DSB-01"]),
        ("readiness", {"ready": True}),
    ]:
        assert (
            client.patch(path, headers=headers(), json={**draft(session), field: value}).status_code
            == 422
        )
    assert (
        client.post(
            "/lab-preparations",
            headers=headers(),
            json={"practicalId": "PR-AM-DSB", "ownerLearnerId": "b"},
        ).status_code
        == 422
    )
    assert start(client, "b")["id"] != session["id"]


@pytest.mark.parametrize(
    "changes",
    [
        {"currentCheckpointId": "foreign"},
        {"prediction": "x" * 3001},
        {"projectRef": "x" * 501},
        {"observationNotes": {"2": "wrong"}},
        {"observationNotes": {"0": "x" * 3001}},
        {"expectedRevision": True},
    ],
)
def test_invalid_drafts_do_not_mutate(lab_harness, changes):
    client, _, _ = lab_harness
    session = start(client)
    path = "/lab-preparations/" + session["id"]
    assert client.patch(path, headers=headers(), json=draft(session, **changes)).status_code == 422
    assert client.get(path, headers=headers()).json()["preparation"] == session


def test_stale_device_does_not_overwrite_and_explicit_reload_recovers(lab_harness):
    client, _, _ = lab_harness
    a = start(client)
    path = "/lab-preparations/" + a["id"]
    first = client.patch(
        path, headers=headers(), json=draft(a, prediction="Saved on laptop")
    ).json()["preparation"]
    assert (
        client.patch(
            path, headers=headers(), json=draft(a, prediction="Old phone copy")
        ).status_code
        == 409
    )
    current = client.get(path, headers=headers()).json()["preparation"]
    assert current == first
    assert (
        client.patch(
            path, headers=headers(), json=draft(current, prediction="Reviewed new draft")
        ).status_code
        == 200
    )


def test_theory_ready_changes_neither_monitoring_nor_assessment(lab_harness):
    client, store, catalog = lab_harness
    session = start(client)
    store.docs[f"learners/a/learningStates/{PLAN}-{catalog.version}"] = {
        "schema": "learning-state/v1",
        "ownerLearnerId": "a",
        "contentVersion": catalog.version,
        "latestChecks": {
            "AS-AM-" + cid[-2:]: {"runId": "test-evidence-" + cid, "passed": True, "percent": 60.0}
            for cid in LAB_CONCEPTS
        },
    }
    updated = client.get("/lab-preparations/" + session["id"], headers=headers()).json()[
        "preparation"
    ]
    assert updated["readiness"]["ready"] is True
    assert updated["readiness"]["chapterTestRequired"] is False
    assert updated["monitoring"] == session["monitoring"]
    folder = ROOT / "apps/api/test-artifacts"
    folder.mkdir(exist_ok=True)
    practical = client.get("/practicals/PR-AM-DSB", headers=headers()).json()
    (folder / "lab-preparation-contract.json").write_text(
        json.dumps({"practical": practical, "preparation": {"preparation": updated}}),
        encoding="utf-8",
    )


def test_version_pinned_session_keeps_original_content(lab_harness):
    client, store, catalog = lab_harness
    session = start(client)
    new = "am-" + "3" * 24
    for path, data in list(catalog.documents.items()):
        store.docs[path.replace(catalog.version, new)] = deepcopy(data)
    store.docs[f"learningCatalog/{PLAN}/versions/{new}"]["contentVersion"] = new
    store.docs[f"learningCatalog/{PLAN}"]["currentVersion"] = new
    assert (
        client.get("/lab-preparations/" + session["id"], headers=headers()).json()["preparation"][
            "contentVersion"
        ]
        == catalog.version
    )
    assert (
        client.get("/lab-preparations/active?practicalId=PR-AM-DSB", headers=headers()).json()[
            "preparation"
        ]
        is None
    )
    assert start(client)["id"] != session["id"]
