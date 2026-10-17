"""Actual routes/DTOs over a transactional test double; no cloud identity or real scores."""

import json
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from test_profiles import FirestoreProfiles, Services, Snapshot, TestVerifier, bootstrap, headers

from kiki_api.backend import BoundaryError
from kiki_api.config import Settings
from kiki_api.learning import FirestoreLearning
from kiki_api.learning_catalog import build_catalog, import_catalog
from kiki_api.learning_models import CONCEPTS, LAB_CONCEPTS, PLAN
from kiki_api.main import create_app

ROOT = Path(__file__).resolve().parents[3]


class Ref:
    def __init__(self, client, path):
        self.client, self.path = client, path

    def collection(self, name):
        return Ref(self.client, self.path + "/" + name)

    def document(self, name):
        return Ref(self.client, self.path + "/" + name)

    def get(self, transaction=None, **kwargs):
        if transaction:
            assert not transaction.writing, "Firestore transactions require reads before writes"
        return Snapshot(self.client.docs.get(self.path))


class Transaction:
    def __init__(self, client):
        self.client, self.writing, self.writes = client, False, []

    def create(self, ref, data):
        assert ref.path not in self.client.docs
        self.writing = True
        self.writes.append((ref.path, deepcopy(data), False))

    def set(self, ref, data, merge=False):
        self.writing = True
        self.writes.append((ref.path, deepcopy(data), merge))

    def update(self, ref, data):
        assert ref.path in self.client.docs
        self.set(ref, data, merge=True)

    def commit(self):
        for path, data, merge in self.writes:
            if merge:
                self.client.docs.setdefault(path, {}).update(data)
            else:
                self.client.docs[path] = data


class Store:
    def __init__(self):
        self.docs = {}

    def collection(self, name):
        return Ref(self, name)

    def document(self, path):
        return Ref(self, path)

    def transaction(self, **kwargs):
        return Transaction(self)


def transactional(function):
    def apply(transaction):
        result = function(transaction)
        transaction.commit()
        return result

    return apply


@pytest.fixture
def catalog():
    return build_catalog(
        ROOT / "data-model/ledgers/electronics/analog-modulation.json",
        ROOT / "data-model/cases/analog-modulation-odia.json",
    )


@pytest.fixture
def learning_harness(monkeypatch, catalog):
    monkeypatch.setattr("kiki_api.learning.firestore.transactional", transactional)
    store = Store()
    import_catalog(store, catalog)
    profiles = FirestoreProfiles(store)
    services = Services(TestVerifier(), profiles, learning=FirestoreLearning(store, profiles))
    settings = Settings(_env_file=None, firebase_project_id="unit-test-project")
    client = TestClient(create_app(settings, lambda: services), raise_server_exceptions=False)
    for user in ["a", "b"]:
        bootstrap(client, user)
        response = client.post(
            "/learners/me/enrollments",
            headers=headers(user),
            json={"courseId": "CRS-AC-ECE", "semester": 5},
        )
        assert response.status_code == 200
    return client, store, catalog


def post(client, path, body, key="operation-0001", user="a", method="post"):
    return getattr(client, method)(
        path, headers={**headers(user), "Idempotency-Key": key}, json=body
    )


def start(client, number=1, key=None, **extra):
    response = post(
        client,
        "/assessment-runs",
        {"assessmentId": f"AS-AM-{number:02}", **extra},
        key=key or f"start-check-{number:02}",
    )
    assert response.status_code == 200, response.text
    return response.json()["run"]


def answers(harness, run, count):
    _, store, _ = harness
    keys = store.docs[f"learners/a/assessmentRuns/{run['runId']}"]["privateKeys"]
    return [
        {
            "questionId": q["questionId"],
            "optionIndex": keys[q["questionId"]]["correctIndex"]
            if i < count
            else (keys[q["questionId"]]["correctIndex"] + 1) % len(q["options"]["en"]),
        }
        for i, q in enumerate(run["questions"])
    ]


def submit(harness, run, count, key=None):
    response = post(
        harness[0],
        f"/assessment-runs/{run['runId']}/submit",
        {"responses": answers(harness, run, count)},
        key=key or "submit-" + run["runId"],
    )
    assert response.status_code == 200, response.text
    return response.json()["result"]


def test_catalog_atomic_idempotent_seed_free_and_versioned(learning_harness):
    _, store, catalog = learning_harness
    before = deepcopy(store.docs)
    assert import_catalog(store, catalog) == "unchanged"
    assert store.docs == before
    assert len(catalog.documents) == 68
    assert not any(p.startswith("learners/") for p in catalog.documents)
    for data in catalog.documents.values():
        assert "seeds" not in data
    changed = deepcopy(catalog)
    changed.version = "am-" + "1" * 24
    with pytest.raises(BoundaryError) as error:
        import_catalog(store, changed)
    assert error.value.status == 409
    assert store.docs == before


def test_all_authored_data_is_preserved_and_seeds_do_not_change_version(catalog, tmp_path):
    ledger_path = ROOT / "data-model/ledgers/electronics/analog-modulation.json"
    case_path = ROOT / "data-model/cases/analog-modulation-odia.json"
    ledger, case = (
        json.loads(ledger_path.read_text(encoding="utf-8")),
        json.loads(case_path.read_text(encoding="utf-8")),
    )
    root = f"learningCatalog/{PLAN}/versions/{catalog.version}"
    docs = catalog.documents
    restored_ledger = {
        **docs[f"{root}/sourceSections/ledger"],
        "course": docs[f"{root}/courses/CRS-AC-ECE"],
        "concepts": [docs[f"{root}/sourceConcepts/{c['id']}"] for c in ledger["concepts"]],
        "terms": [docs[f"{root}/terms/{t['id']}"]["source"] for t in ledger["terms"]],
        "practicals": [docs[f"{root}/practicals/PR-AM-DSB"]["ledger"]],
    }
    restored_case = {
        **docs[f"{root}/sourceSections/case"],
        "placards": docs[f"{root}/sourceSections/placards"]["placards"],
        "practical": docs[f"{root}/practicals/PR-AM-DSB"]["case"],
    }
    assert restored_ledger == ledger
    assert restored_case == {k: v for k, v in case.items() if k != "seeds"}
    case["seeds"] = {"synthetic": "different preview learner and scores"}
    changed_case = tmp_path / "case.json"
    changed_case.write_text(json.dumps(case), encoding="utf-8")
    assert build_catalog(ledger_path, changed_case).documents == catalog.documents


@pytest.mark.parametrize(
    "path",
    [
        f"/lesson-plans/{PLAN}",
        "/concepts/C-AM-01/lesson",
        f"/learners/me/progress?planId={PLAN}",
        f"/learners/me/assessment-overview?planId={PLAN}",
    ],
)
def test_learning_requires_google_and_enrollment(learning_harness, path):
    client, store, _ = learning_harness
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer forged"}).status_code == 401
    store.docs["learners/b"]["courseIds"] = []
    assert client.get(path, headers=headers("b")).status_code == 403


def test_public_content_has_draft_labels_and_no_keys(learning_harness):
    client, _, _ = learning_harness
    chapter = client.get(f"/lesson-plans/{PLAN}", headers=headers()).json()["chapter"]
    assert len(chapter["concepts"]) == 10
    assert chapter["review"] == {"content": "draft", "odia": "draft"}
    for cid in CONCEPTS:
        response = client.get(f"/concepts/{cid}/lesson", headers=headers())
        assert response.status_code == 200, response.text
        lesson = response.json()["lesson"]
        assert len(lesson["placards"]) == 4
        assert lesson["keyIdea"]["en"] != lesson["keyIdea"]["or"]
        assert "answer" not in response.text and "correctIndex" not in response.text
    assert client.get("/lesson-plans/foreign", headers=headers()).status_code == 404
    assert client.get("/concepts/foreign/lesson", headers=headers()).status_code == 404


def test_positions_are_owned_repeat_safe_preserve_other_fields_and_never_pass(learning_harness):
    client, store, _ = learning_harness
    before_profile = deepcopy(store.docs["learners/a"])
    path = "/learners/me/positions/C-AM-01"
    body = {"placardId": "CARD-AM-01-concept"}
    response = client.put(path, headers=headers(), json=body)
    assert response.status_code == 200, response.text
    saved = response.json()["position"]
    assert saved["status"] == "learning"
    assert "latestRunId" not in saved["theoryCheck"]
    assert client.put(path, headers=headers(), json=body).json()["position"] == saved
    assert (
        client.put(path, headers=headers(), json={"placardId": "CARD-AM-02-concept"}).status_code
        == 422
    )
    assert client.put(path, headers=headers(), json={**body, "uid": "b"}).status_code == 422
    for user in ["a", "b"]:
        progress = client.get(f"/learners/me/progress?planId={PLAN}", headers=headers(user)).json()[
            "progress"
        ]
        assert progress["ownerLearnerId"] == user
        assert progress["rings"] == {"concept": None, "words": None, "english": None, "lab": None}
        assert progress["labReadiness"]["ready"] is False
        assert (progress["concepts"][0]["status"] == "learning") == (user == "a")
    assert store.docs["learners/a"] == before_profile


def test_start_assignment_keys_private_duplicate_requests_and_active_resume(learning_harness):
    client, store, _ = learning_harness
    run = start(client)
    assert run["origin"] == "student_attempt" and run["attemptNumber"] == 1
    assert len(run["questions"]) == 5 and run["passPercent"] == 60
    assert "correctIndex" not in json.dumps(run) and "explanation" not in json.dumps(run)
    assert start(client) == run
    assert start(client, key="different-start-key") == run
    assert len([p for p in store.docs if p.startswith("learners/a/assessmentRuns/")]) == 1
    conflict = post(client, "/assessment-runs", {"assessmentId": "AS-AM-02"}, key="start-check-01")
    assert conflict.status_code == 409
    assert post(client, "/assessment-runs", {"assessmentId": "missing"}).status_code == 404
    assert (
        post(client, "/assessment-runs", {"assessmentId": "AS-AM-01", "passed": True}).status_code
        == 422
    )
    assert (
        post(client, "/assessment-runs", {"assessmentId": "AS-AM-01"}, key="short").status_code
        == 422
    )


def test_runs_results_and_lineage_cannot_cross_accounts(learning_harness):
    client, _, _ = learning_harness
    run = start(client)
    path = "/assessment-runs/" + run["runId"]
    assert client.get(path, headers=headers("b")).status_code == 404
    assert (
        post(
            client,
            path + "/draft",
            {"responses": [], "currentQuestionIndex": 0, "expectedRevision": 0},
            user="b",
            method="put",
        ).status_code
        == 404
    )
    assert (
        post(
            client, path + "/submit", {"responses": answers(learning_harness, run, 5)}, user="b"
        ).status_code
        == 404
    )
    assert client.get(path + "/result", headers=headers("b")).status_code == 404
    assert (
        post(
            client,
            "/assessment-runs",
            {"assessmentId": "AS-AM-01", "previousRunId": run["runId"]},
            user="b",
            key="foreign-lineage",
        ).status_code
        == 404
    )


def test_draft_revision_idempotency_resume_and_incomplete_submit(learning_harness):
    client, _, _ = learning_harness
    run = start(client)
    path = "/assessment-runs/" + run["runId"]
    body = {
        "responses": answers(learning_harness, run, 3)[:2],
        "currentQuestionIndex": 1,
        "expectedRevision": 0,
    }
    first = post(client, path + "/draft", body, method="put")
    assert first.status_code == 200, first.text
    assert first.json()["run"]["revision"] == 1
    assert post(client, path + "/draft", body, method="put").json() == first.json()
    assert (
        post(client, path + "/draft", body, method="put", key="stale-draft-key").status_code == 409
    )
    assert (
        post(client, path + "/draft", {**body, "currentQuestionIndex": 2}, method="put").status_code
        == 409
    )
    assert client.get(path, headers=headers()).json() == first.json()
    assert (
        post(
            client, path + "/submit", {"responses": body["responses"]}, key="incomplete-key"
        ).status_code
        == 422
    )
    assert client.get(path + "/result", headers=headers()).status_code == 409


@pytest.mark.parametrize("bad", ["foreign", "duplicate", "range", "negative", "float", "boolean"])
def test_invalid_answers_rejected(learning_harness, bad):
    client, _, _ = learning_harness
    run = start(client)
    responses = answers(learning_harness, run, 5)
    if bad == "foreign":
        responses[0]["questionId"] = "foreign"
    elif bad == "duplicate":
        responses[0] = responses[1]
    else:
        responses[0]["optionIndex"] = {"range": 20, "negative": -1, "float": 1.5, "boolean": True}[
            bad
        ]
    assert (
        post(
            client, f"/assessment-runs/{run['runId']}/submit", {"responses": responses}
        ).status_code
        == 422
    )


@pytest.mark.parametrize("count,passed", [(2, False), (3, True)])
def test_server_scores_and_projects_same_result_and_finalizes_once(learning_harness, count, passed):
    client, _, _ = learning_harness
    run = start(client)
    result = submit(learning_harness, run, count)
    assert result["correct"] == count and result["passed"] == passed
    assert result["percent"] == count * 20 and len(result["feedback"]) == 5
    assert submit(learning_harness, run, count) == result
    assert submit(learning_harness, run, count, key="second-submit-key") == result
    path = f"/assessment-runs/{run['runId']}"
    assert (
        post(
            client,
            path + "/submit",
            {"responses": answers(learning_harness, run, 5)},
            key="changed-submit-key",
        ).status_code
        == 409
    )
    assert client.get(path + "/result", headers=headers()).json()["result"] == result
    progress = client.get(f"/learners/me/progress?planId={PLAN}", headers=headers()).json()[
        "progress"
    ]
    assert progress["concepts"][0]["status"] == ("passed" if passed else "revisit")
    assert progress["rings"]["concept"]["done"] == int(passed)
    assert progress["concepts"][0]["theoryCheck"]["latestRunId"] == run["runId"]


def test_retry_keeps_previous_evidence_until_completion_then_latest_wins(learning_harness):
    client, _, _ = learning_harness
    first = start(client)
    submit(learning_harness, first, 5)
    retry = start(client, key="retry-check-key", previousRunId=first["runId"])
    assert retry["attemptNumber"] == 2

    def overview():
        return client.get(
            f"/learners/me/assessment-overview?planId={PLAN}", headers=headers()
        ).json()["overview"]

    assert overview()["concepts"][0]["status"] == "passed"
    submit(learning_harness, retry, 2)
    assert overview()["concepts"][0]["status"] == "revisit"
    assert len(overview()["attempts"]) == 2
    assert (
        client.get(f"/assessment-runs/{first['runId']}/result", headers=headers()).status_code
        == 200
    )


@pytest.mark.parametrize("chapter_correct,passed", [(7, False), (8, True)])
def test_seven_lab_prerequisites_and_all_ten_chapter_gates(
    learning_harness, chapter_correct, passed
):
    client, _, _ = learning_harness

    def overview():
        return client.get(
            f"/learners/me/assessment-overview?planId={PLAN}", headers=headers()
        ).json()["overview"]

    def chapter_start(key):
        return post(client, "/assessment-runs", {"assessmentId": "AS-AM-CHAPTER"}, key=key)

    assert chapter_start("initial-chapter-key").status_code == 409
    for cid in LAB_CONCEPTS:
        run = start(client, int(cid[-2:]))
        submit(learning_harness, run, 3)
    assert overview()["labReady"] and not overview()["chapterAllowed"]
    assert chapter_start("seven-chapter-key").status_code == 409
    for cid in CONCEPTS:
        if cid not in LAB_CONCEPTS:
            submit(learning_harness, start(client, int(cid[-2:])), 3)
    assert overview()["chapterAllowed"]
    response = chapter_start("ready-chapter-key")
    assert response.status_code == 200, response.text
    chapter_run = response.json()["run"]
    assert len({q["conceptId"] for q in chapter_run["questions"]}) == 10
    assert submit(learning_harness, chapter_run, chapter_correct)["passed"] == passed
    assert overview()["labReady"]


def test_catalog_switch_preserves_old_run_keys_and_does_not_reuse_old_mastery(learning_harness):
    client, store, catalog = learning_harness
    run = start(client)
    old = catalog.version
    new = "am-" + "2" * 24
    # A new catalog version is test-only; no real student's records are modified.
    for path, data in list(catalog.documents.items()):
        store.docs[path.replace(old, new)] = deepcopy(data)
    store.docs[f"learningCatalog/{PLAN}/versions/{new}"]["contentVersion"] = new
    store.docs[f"learningCatalog/{PLAN}"]["currentVersion"] = new
    submit(learning_harness, run, 5)
    progress = client.get(f"/learners/me/progress?planId={PLAN}", headers=headers()).json()[
        "progress"
    ]
    assert progress["concepts"][0]["status"] == "not_started"
    fresh = start(client, key="new-version-run-key")
    assert fresh["contentVersion"] == new and fresh["attemptNumber"] == 1
    assert client.get(f"/assessment-runs/{run['runId']}/result", headers=headers()).json()[
        "result"
    ]["passed"]


def test_missing_or_corrupt_catalog_state_fails_closed(learning_harness):
    client, store, catalog = learning_harness
    path = f"/learners/me/progress?planId={PLAN}"
    state_path = f"learners/a/learningStates/{PLAN}-{catalog.version}"
    store.docs[state_path] = {"ownerLearnerId": "b", "contentVersion": catalog.version}
    assert client.get(path, headers=headers()).status_code == 503
    assert store.docs[state_path]["ownerLearnerId"] == "b"
    del store.docs[f"learningCatalog/{PLAN}"]
    assert client.get(f"/lesson-plans/{PLAN}", headers=headers()).status_code == 503


def test_put_cors_and_public_contract_export(learning_harness):
    client, _, _ = learning_harness
    cors = client.options(
        "/learners/me/positions/C-AM-01",
        headers={
            "Origin": "http://127.0.0.1:5174",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
        },
    )
    assert cors.status_code == 200
    # Export actual public receipts for the explicit web contract verification command.
    run = start(client)
    result = submit(learning_harness, run, 3)
    data = {
        "chapter": client.get(f"/lesson-plans/{PLAN}", headers=headers()).json(),
        "lesson": client.get("/concepts/C-AM-01/lesson", headers=headers()).json(),
        "visualLesson": client.get("/concepts/C-AM-04/lesson", headers=headers()).json(),
        "progress": client.get(f"/learners/me/progress?planId={PLAN}", headers=headers()).json(),
        "position": client.put(
            "/learners/me/positions/C-AM-01",
            headers=headers(),
            json={"placardId": "CARD-AM-01-concept"},
        ).json(),
        "run": {"run": run},
        "result": {"result": result},
        "overview": client.get(
            f"/learners/me/assessment-overview?planId={PLAN}", headers=headers()
        ).json(),
    }
    folder = ROOT / "apps/api/test-artifacts"
    folder.mkdir(exist_ok=True)
    (folder / "learning-contract.json").write_text(
        json.dumps(data, ensure_ascii=False), encoding="utf-8"
    )


def test_teaching_visual_reads_existing_source_without_migration_or_progress_writes(
    learning_harness,
):
    client, store, catalog = learning_harness
    before = deepcopy(store.docs)
    response = client.get("/concepts/C-AM-04/lesson", headers=headers())
    assert response.status_code == 200
    visual = response.json()["lesson"]["visual"]
    assert visual["schema"] == "dsb-sc-visual/v1"
    assert visual["kind"] == "dsb_sc"
    assert visual["messageFrequencyHz"] == 100
    assert visual["carrierFrequencyHz"] == 2000
    assert visual["messageRangeHz"] == {"min": 10, "max": 200, "step": 10}
    assert visual["sidebandTermId"] == "T-AM-04-2"
    assert visual["sources"]
    assert (
        "visual" not in client.get("/concepts/C-AM-01/lesson", headers=headers()).json()["lesson"]
    )
    assert store.docs == before
    assert catalog.version == "am-51187527300cba2fa3cca868"


def test_teaching_projection_rejects_unrecognised_or_unsafe_source(catalog):
    from kiki_api.teaching_visuals import project_dsb_visual

    source = next(
        deepcopy(value)
        for key, value in catalog.documents.items()
        if key.endswith("/sourceConcepts/C-AM-04")
    )
    source["explanation"]["modalities"]["interactive"]["inputs"][0]["unit"] = "kHz"
    with pytest.raises(ValueError, match="Hz"):
        project_dsb_visual(source)
    source["id"] = "C-AM-01"
    with pytest.raises(ValueError, match="Unsupported"):
        project_dsb_visual(source)
