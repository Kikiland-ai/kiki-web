"""Tutor HTTP routes over the real app, a fake classifier and the in-memory store;
plus the Firestore store's transaction logic over a fake client."""

from copy import deepcopy
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from test_profiles import FirestoreDouble, FirestoreProfiles, Services, TestVerifier, headers

from kiki_api.config import Settings
from kiki_api.main import create_app
from kiki_api.tutor.classifier import FakeClassifier
from kiki_api.tutor.engine import start as engine_start
from kiki_api.tutor.service import TutorService, load_questions
from kiki_api.tutor.store import Conflict, FirestoreTutorStore, MemoryTutorStore, Missing

QUESTIONS = load_questions()
PHASE = QUESTIONS["ece-phase-error"]
GOOD = {
    "it gets weaker": "part-survives",
    "times cos phi": "scaled-by-cos",
    "half": "half",
    "zero, it vanishes": "vanishes",
    "because the local carrier is out of phase the output is m(t) cos phi": "clear-explanation",
}
CORRECT_PATH = list(GOOD)


def make(monkeypatch, tutor=True, classifier=None):
    monkeypatch.delenv("FIREBASE_AUTH_EMULATOR_HOST", raising=False)
    monkeypatch.delenv("FIRESTORE_EMULATOR_HOST", raising=False)
    store = MemoryTutorStore()
    clf = classifier or FakeClassifier(GOOD)
    svc = TutorService(QUESTIONS, clf, store) if tutor else None
    services = Services(TestVerifier(), FirestoreProfiles(FirestoreDouble()), tutor=svc)
    settings = Settings(_env_file=None, firebase_project_id="unit-test-project")
    client = TestClient(create_app(settings, Mock(return_value=services)), raise_server_exceptions=False)
    return client, store, clf


def key(n):
    return {"Idempotency-Key": f"key-{n:06d}"}


def h(user="a", n=0):
    return {**headers(user), **key(n)}


def begin(client, user="a", n=1, lang="en"):
    r = client.post("/tutor/sessions", json={"questionId": "ece-phase-error", "lang": lang}, headers=h(user, n))
    assert r.status_code == 201, r.text
    return r.json()


def answers_on_board_too_early(view):
    if view["done"]:
        return set()
    node = PHASE.stages[view["stageIndex"]].nodes[view["node"]]
    if view["hintLevel"] >= 4:
        return set()
    return set(node.answerItems) & {i["id"] for i in view["board"]}


def test_requires_sign_in(monkeypatch):
    client, _, _ = make(monkeypatch)
    assert client.post("/tutor/sessions", json={"questionId": "ece-phase-error"}, headers=key(1)).status_code == 401


def test_disabled_tutor_is_503(monkeypatch):
    client, _, _ = make(monkeypatch, tutor=False)
    r = client.post("/tutor/sessions", json={"questionId": "ece-phase-error"}, headers=h())
    assert r.status_code == 503


def test_question_view_has_no_board_or_graph(monkeypatch):
    client, _, _ = make(monkeypatch)
    r = client.get("/tutor/questions/ece-phase-error", headers=headers())
    body = r.json()
    assert r.status_code == 200 and [s["id"] for s in body["stages"]][0] == "predict"
    text = r.text
    assert "board" not in body and "mustNotReveal" not in text and "cos60" not in text
    assert client.get("/tutor/questions/nope", headers=headers()).status_code == 404


def test_start_shows_only_the_question_and_is_idempotent(monkeypatch):
    client, _, _ = make(monkeypatch)
    a = begin(client, n=1)
    assert [i["id"] for i in a["board"]] == ["q"] and a["brief"]["expectsReply"]
    assert [s["kind"] for s in a["brief"]["segments"]] == ["framing", "intro", "probe"]
    assert "goal" not in a["brief"] and "mustNotReveal" not in a["brief"]     # scripted mode
    assert {c["route"] for c in a["chips"]} == {"part-survives", "phase-does-not-matter",
                                                "any-error-loses-all", "unclear"}
    again = begin(client, n=1)
    assert again == a
    assert begin(client, n=2)["sessionId"] != a["sessionId"]


def test_full_text_session_reaches_done_without_early_answers(monkeypatch):
    client, store, clf = make(monkeypatch)
    view = begin(client)
    sid = view["sessionId"]
    for n, text in enumerate(CORRECT_PATH, start=10):
        assert not answers_on_board_too_early(view)
        r = client.post(f"/tutor/sessions/{sid}/turns", json={"text": text}, headers=h(n=n))
        assert r.status_code == 200, r.text
        view = r.json()
        assert view["route"]["label"] == GOOD[text]
    assert view["done"] and view["status"] == "completed" and view["chips"] == []
    assert "result" in [i["id"] for i in view["board"]]
    assert client.get(f"/tutor/sessions/{sid}", headers=headers()).json() == view
    types = [e.type for e in store.events("a", sid)]
    assert types.count("stage_completed") == 5 and types[-1] == "session_completed"
    assert clf.calls == CORRECT_PATH


def test_chip_routes_without_the_classifier(monkeypatch):
    client, _, clf = make(monkeypatch)
    sid = begin(client)["sessionId"]
    r = client.post(f"/tutor/sessions/{sid}/turns", json={"chip": "phase-does-not-matter"}, headers=h(n=5))
    assert r.status_code == 200 and clf.calls == []
    body = r.json()
    assert body["node"] == "why-cos" and [s["kind"] for s in body["brief"]["segments"]] == ["show", "intro", "probe"]
    bad = client.post(f"/tutor/sessions/{sid}/turns", json={"chip": "half"}, headers=h(n=6))
    assert bad.status_code == 422


@pytest.mark.parametrize("body", [{}, {"text": "a", "chip": "half"}, {"text": ""}, {"text": "x", "extra": 1}])
def test_turn_body_validation(monkeypatch, body):
    client, _, _ = make(monkeypatch)
    sid = begin(client)["sessionId"]
    assert client.post(f"/tutor/sessions/{sid}/turns", json=body, headers=h(n=3)).status_code == 422


def test_turn_requires_an_idempotency_key(monkeypatch):
    client, _, _ = make(monkeypatch)
    sid = begin(client)["sessionId"]
    assert client.post(f"/tutor/sessions/{sid}/turns", json={"text": "half"}, headers=headers()).status_code == 422


def test_duplicate_turn_replays_without_moving_again(monkeypatch):
    client, store, clf = make(monkeypatch)
    sid = begin(client)["sessionId"]
    first = client.post(f"/tutor/sessions/{sid}/turns", json={"text": "it gets weaker"}, headers=h(n=7)).json()
    count = len(store.events("a", sid))
    again = client.post(f"/tutor/sessions/{sid}/turns", json={"text": "it gets weaker"}, headers=h(n=7)).json()
    assert again == first and len(store.events("a", sid)) == count and clf.calls == ["it gets weaker"]


def test_sessions_are_owner_scoped(monkeypatch):
    client, _, _ = make(monkeypatch)
    sid = begin(client, user="a")["sessionId"]
    assert client.get(f"/tutor/sessions/{sid}", headers=headers("b")).status_code == 404
    r = client.post(f"/tutor/sessions/{sid}/turns", json={"text": "half"}, headers=h("b", 9))
    assert r.status_code == 404


def test_completed_session_rejects_turns(monkeypatch):
    client, _, _ = make(monkeypatch)
    sid = begin(client)["sessionId"]
    for n, chip in enumerate(["part-survives", "scaled-by-cos", "half", "vanishes", "partial-explanation"], 20):
        client.post(f"/tutor/sessions/{sid}/turns", json={"chip": chip}, headers=h(n=n))
    r = client.post(f"/tutor/sessions/{sid}/turns", json={"text": "more"}, headers=h(n=99))
    assert r.status_code == 409


def test_unlabelled_reply_gets_the_first_hint(monkeypatch):
    client, _, _ = make(monkeypatch, classifier=FakeClassifier({}))   # everything → unclear
    sid = begin(client)["sessionId"]
    body = client.post(f"/tutor/sessions/{sid}/turns", json={"text": "hmm"}, headers=h(n=4)).json()
    assert body["route"]["label"] == "unclear" and body["hintLevel"] == 1
    assert [s["kind"] for s in body["brief"]["segments"]] == ["hint"]


def test_speech_leak_is_logged(monkeypatch):
    client, store, _ = make(monkeypatch)
    sid = begin(client)["sessionId"]
    for n, chip in enumerate(["part-survives", "scaled-by-cos"], 30):
        client.post(f"/tutor/sessions/{sid}/turns", json={"chip": chip}, headers=h(n=n))
    ok = client.post(f"/tutor/sessions/{sid}/speech", json={"text": "Use that factor. What fraction?"}, headers=headers())
    assert ok.json() == {"leaks": []}
    bad = client.post(f"/tutor/sessions/{sid}/speech", json={"text": "So it is HALF, 0.5. What fraction?"}, headers=headers())
    assert sorted(bad.json()["leaks"]) == ["0.5", "half"]
    leaks = [e.phrase for e in store.events("a", sid) if e.type == "speech_leak"]
    assert sorted(leaks) == ["0.5", "half"]
    # the session still accepts the next turn after the leak write bumped the version
    r = client.post(f"/tutor/sessions/{sid}/turns", json={"chip": "half"}, headers=h(n=40))
    assert r.status_code == 200 and r.json()["node"] == "predict-90"


# ---------------------------------------------------------------- Firestore store logic


class _Snap:
    def __init__(self, data):
        self.exists, self._d = data is not None, deepcopy(data)

    def to_dict(self):
        return deepcopy(self._d)


class _Ref:
    def __init__(self, db, path):
        self.db, self.path = db, path

    def collection(self, name):
        return _Ref(self.db, f"{self.path}/{name}")

    def document(self, name):
        return _Ref(self.db, f"{self.path}/{name}")

    def get(self, transaction=None):
        return _Snap(self.db.docs.get(self.path))

    def order_by(self, field):
        self._order = field
        return self

    def stream(self):
        prefix = self.path + "/"
        rows = [(p, d) for p, d in self.db.docs.items() if p.startswith(prefix) and "/" not in p[len(prefix):]]
        return [_Snap(d) for _, d in sorted(rows, key=lambda r: r[1][self._order])]


class _Tx:
    def __init__(self, db):
        self.db = db

    def create(self, ref, data):
        assert ref.path not in self.db.docs, f"create on existing {ref.path}"
        self.db.docs[ref.path] = deepcopy(data)

    def update(self, ref, data):
        self.db.docs[ref.path].update(deepcopy(data))


class _Db:
    def __init__(self):
        self.docs = {}

    def collection(self, name):
        return _Ref(self, name)

    def transaction(self, max_attempts):
        return _Tx(self)


@pytest.fixture
def fstore(monkeypatch):
    import firebase_admin.firestore as fs

    monkeypatch.setattr(fs, "transactional", lambda f: f)
    return FirestoreTutorStore(_Db())


def test_firestore_store_round_trip_and_guards(fstore):
    first = engine_start(PHASE, "en")
    fstore.create("u", "s1", first.state, first.events, {"v": 0})
    with pytest.raises(Conflict):
        fstore.create("u", "s1", first.state, first.events, {"v": 0})
    state, last = fstore.load("u", "s1")
    assert state == first.state and last == {"v": 0}
    assert [e.seq for e in fstore.events("u", "s1")] == list(range(len(first.events)))

    from kiki_api.tutor.engine import step
    from kiki_api.tutor.session import Reply

    nxt = step(PHASE, state, Reply(mode="chip", text="x", label="part-survives"))
    assert fstore.commit("u", "s1", state.version, nxt.state, nxt.events, "k1", {"v": 1}) == {"v": 1}
    assert fstore.commit("u", "s1", state.version, nxt.state, nxt.events, "k1", {"v": 9}) == {"v": 1}  # replay
    with pytest.raises(Conflict):
        fstore.commit("u", "s1", state.version, nxt.state, nxt.events, "k2", {"v": 2})                # stale
    assert fstore.turn_response("u", "s1", "k1") == {"v": 1} and fstore.turn_response("u", "s1", "zz") is None
    assert len(fstore.events("u", "s1")) == len(first.events) + len(nxt.events)
    with pytest.raises(Missing):
        fstore.load("other", "s1")
