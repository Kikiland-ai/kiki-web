"""Hardening: configuration, startup isolation, health, caps, and concurrency between voice and turns."""

from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_profiles import FirestoreDouble, FirestoreProfiles, Services, TestVerifier, headers

from kiki_api.config import Settings
from kiki_api.main import create_app
from kiki_api.tutor import wiring
from kiki_api.tutor.classifier import FakeClassifier
from kiki_api.tutor.service import MAX_EVENTS, MAX_VOICE_TOKENS, TutorError, TutorService, load_questions, session_id
from kiki_api.tutor.store import MemoryTutorStore

Q = load_questions()


def settings(**kw):
    return Settings(_env_file=None, firebase_project_id="unit-test-project", **kw)


# ---------------------------------------------------------------- configuration


def test_enabling_the_tutor_without_a_key_fails_fast():
    with pytest.raises(ValidationError, match="KIKI_GEMINI_API_KEY"):
        settings(tutor_enabled=True)
    with pytest.raises(ValidationError, match="KIKI_GEMINI_API_KEY"):
        settings(tutor_enabled=True, gemini_api_key="   ")
    assert settings(tutor_enabled=True, gemini_api_key="k").tutor_enabled


@pytest.mark.parametrize("model", ["", "gemini 3.8", "models/../x", "gemini-3.8-live?x=1"])
def test_model_ids_are_plain(model):
    with pytest.raises(ValidationError):
        settings(tutor_live_model=model)


def test_the_key_never_appears_in_settings_repr():
    s = settings(tutor_enabled=True, gemini_api_key="super-secret-value")
    assert "super-secret-value" not in repr(s) and "super-secret-value" not in str(s.model_dump())


# ---------------------------------------------------------------- startup isolation


def test_disabled_tutor_reports_why():
    assert wiring.build_tutor(settings(), client=None) is None
    assert wiring.STATUS == {"enabled": False, "reason": "KIKI_TUTOR_ENABLED is off"}


def test_bad_tutor_content_disables_only_the_tutor(monkeypatch):
    import kiki_api.tutor.service as service

    monkeypatch.setattr(service, "load_questions", lambda: (_ for _ in ()).throw(ValueError("Tutor question x.json is invalid")))
    tutor = wiring.build_tutor(settings(tutor_enabled=True, gemini_api_key="k"), client=None, store=MemoryTutorStore())
    assert tutor is None and wiring.STATUS["reason"] == "startup failed: ValueError"


def test_enabled_tutor_builds_without_network_and_reports_models():
    tutor = wiring.build_tutor(settings(tutor_enabled=True, gemini_api_key="k"), client=None, store=MemoryTutorStore())
    assert tutor is not None
    assert wiring.STATUS["enabled"] and wiring.STATUS["liveModel"] == "gemini-3.8-live"
    assert set(wiring.STATUS["questions"]) == set(load_questions())


def test_health_is_public_and_secret_free(monkeypatch):
    monkeypatch.delenv("FIREBASE_AUTH_EMULATOR_HOST", raising=False)
    monkeypatch.setattr("kiki_api.backend.firestore.transactional", lambda function: function)
    wiring.build_tutor(settings(), client=None)
    services = Services(TestVerifier(), FirestoreProfiles(FirestoreDouble()))
    client = TestClient(create_app(settings(), Mock(return_value=services)))
    r = client.get("/tutor/health")
    assert r.status_code == 200 and r.json() == {"enabled": False, "reason": "KIKI_TUTOR_ENABLED is off"}
    # profiles are unaffected by the tutor being off
    assert client.post("/learners/me/bootstrap", headers=headers()).status_code == 200


# ---------------------------------------------------------------- ids and caps


class _Voice:
    def mint(self):
        return {"token": "auth_tokens/t", "model": "gemini-3.8-live", "expiresAt": "x", "prompt": "voice.v1"}


def svc(store=None, voice=None):
    return TutorService(Q, FakeClassifier({"weaker": "part-survives"}), store or MemoryTutorStore(), voice=voice)


def test_session_ids_never_cross_questions_or_languages():
    ids = {session_id("u", q, lang, "same-key") for q in Q for lang in ("en", "or")}
    assert len(ids) == 2 * len(Q)
    s = svc()
    a = s.start("u", "ece-phase-error", "en", "same-key-01")
    b = s.start("u", "ece-dsb-receive-drift", "en", "same-key-01")
    assert a["sessionId"] != b["sessionId"] and b["questionId"] == "ece-dsb-receive-drift"


def test_voice_tokens_are_capped_per_session():
    s = svc(voice=_Voice())
    sid = s.start("u", "ece-phase-error", "en", "cap-key-001")["sessionId"]
    for _ in range(MAX_VOICE_TOKENS):
        assert s.voice_token("u", sid)["token"]
    with pytest.raises(TutorError) as capped:
        s.voice_token("u", sid)
    assert capped.value.status == 429 and "typing" in capped.value.message


def test_speech_leaks_are_logged_once_per_turn():
    store = MemoryTutorStore()
    s = svc(store)
    sid = s.start("u", "ece-phase-error", "en", "leak-key-01")["sessionId"]
    for _ in range(5):
        assert s.speech("u", sid, "is it half? so 0.5")["leaks"] == ["half", "0.5"]
    assert sorted(e.phrase for e in store.events("u", sid) if e.type == "speech_leak") == ["0.5", "half"]


def test_runaway_sessions_stop_at_the_event_cap():
    store = MemoryTutorStore()
    s = svc(store)
    sid = s.start("u", "ece-phase-error", "en", "cap-key-002")["sessionId"]
    store.sessions[("u", sid)]["state"] = store.sessions[("u", sid)]["state"].model_copy(update={"seq": MAX_EVENTS})
    with pytest.raises(TutorError) as long:
        s.turn("u", sid, "turn-key-0001", "weaker", None, "text")
    assert long.value.status == 409


# ---------------------------------------------------------------- voice/turn race


def test_a_speech_log_landing_mid_turn_does_not_break_the_turn():
    store = MemoryTutorStore()
    s = svc(store)
    sid = s.start("u", "ece-phase-error", "en", "race-key-01")["sessionId"]
    real_commit = store.commit
    calls = {"n": 0}

    def racing_commit(*args, **kw):
        calls["n"] += 1
        if calls["n"] == 1:
            s.speech("u", sid, "is it half")      # KiKi's transcript arrives while we classify
        return real_commit(*args, **kw)

    store.commit = racing_commit
    view = s.turn("u", sid, "race-turn-001", "weaker", None, "voice")
    assert calls["n"] == 2 and view["node"] == "why-cos"
    types = [e.type for e in store.events("u", sid)]
    assert types.count("speech_leak") == 1 and types.count("student_turn") == 1


def test_a_real_concurrent_turn_still_conflicts():
    store = MemoryTutorStore()
    s = svc(store)
    sid = s.start("u", "ece-phase-error", "en", "race-key-02")["sessionId"]
    real_commit = store.commit

    def other_turn_first(*args, **kw):
        store.commit = real_commit
        s.turn("u", sid, "other-turn-01", None, "phase-does-not-matter", "text")   # moves the graph
        return real_commit(*args, **kw)

    store.commit = other_turn_first
    with pytest.raises(TutorError) as conflict:
        s.turn("u", sid, "race-turn-002", "weaker", None, "text")
    assert conflict.value.status == 409
