"""Hardening: configuration, startup isolation, health, caps, and concurrency between voice and
turns."""

from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_profiles import FirestoreDouble, FirestoreProfiles, Services, TestVerifier, headers

from kiki_api.config import Settings
from kiki_api.main import create_app
from kiki_api.tutor import wiring
from kiki_api.tutor.classifier import FakeClassifier
from kiki_api.tutor.service import (
    MAX_EVENTS,
    MAX_VOICE_TOKENS,
    TutorError,
    TutorService,
    load_questions,
    session_id,
)
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

    monkeypatch.setattr(
        service,
        "load_questions",
        lambda: (_ for _ in ()).throw(ValueError("Tutor question x.json is invalid")),
    )
    tutor = wiring.build_tutor(
        settings(tutor_enabled=True, gemini_api_key="k"), client=None, store=MemoryTutorStore()
    )
    assert tutor is None and wiring.STATUS["reason"] == "startup failed: ValueError"


def test_enabled_tutor_builds_without_network_and_reports_models():
    tutor = wiring.build_tutor(
        settings(tutor_enabled=True, gemini_api_key="k"), client=None, store=MemoryTutorStore()
    )
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
    assert r.status_code == 200 and r.json() == {
        "enabled": False,
        "reason": "KIKI_TUTOR_ENABLED is off",
    }
    # profiles are unaffected by the tutor being off
    assert client.post("/learners/me/bootstrap", headers=headers()).status_code == 200


# ---------------------------------------------------------------- ids and caps


class _Voice:
    def mint(self, lang="en"):
        return {
            "token": "auth_tokens/t",
            "model": "gemini-3.8-live",
            "expiresAt": "x",
            "prompt": "voice.v1",
        }


def svc(store=None, voice=None):
    return TutorService(
        Q, FakeClassifier({"weaker": "part-survives"}), store or MemoryTutorStore(), voice=voice
    )


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
    assert sorted(e.phrase for e in store.events("u", sid) if e.type == "speech_leak") == [
        "0.5",
        "half",
    ]


def test_runaway_sessions_stop_at_the_event_cap():
    store = MemoryTutorStore()
    s = svc(store)
    sid = s.start("u", "ece-phase-error", "en", "cap-key-002")["sessionId"]
    store.sessions[("u", sid)]["state"] = store.sessions[("u", sid)]["state"].model_copy(
        update={"seq": MAX_EVENTS}
    )
    with pytest.raises(TutorError) as long:
        s.turn("u", sid, "turn-key-0001", "weaker", None, "text")
    assert long.value.status == 409


# ---------------------------------------------------------------- provider outage


class _DownClassifier:
    def classify(self, q, state, text, mode="text"):
        from kiki_api.tutor.classifier import Labelled
        from kiki_api.tutor.session import Reply

        return Labelled(
            Reply(mode=mode, text=text, label="unclear", confidence=0.0), 3000, "ClientError"
        )


def test_a_provider_outage_asks_to_repeat_and_changes_nothing():
    store = MemoryTutorStore()
    s = TutorService(Q, _DownClassifier(), store)
    first = s.start("u", "ece-phase-error", "en", "outage-key-1")
    sid, events_before = first["sessionId"], len(store.events("u", first["sessionId"]))
    state_before = store.load("u", sid)[0]
    view = s.turn("u", sid, "outage-turn-1", "part of it comes back", None, "voice")
    assert view["retry"] is True and view["route"]["label"] == "retry"
    assert view["node"] == "predict-60" and view["hintLevel"] == 0
    assert view["brief"]["say"].startswith("Sorry, I couldn't process that just now.")
    assert view["brief"]["segments"][0]["kind"] == "restate"
    assert store.load("u", sid)[0] == state_before and len(store.events("u", sid)) == events_before
    # the student can simply try again; the turn key was not burned
    s.classifier = FakeClassifier({"part of it comes back": "part-survives"})
    assert (
        s.turn("u", sid, "outage-turn-1", "part of it comes back", None, "voice")["node"]
        == "why-cos"
    )


def test_voice_noise_keeps_listening_without_spending_a_hint():
    """Live run, 20 Nov: 'Ah', 'coche', 'yani' each spent a hint rung."""
    from kiki_api.tutor.service import is_voice_noise

    assert all(is_voice_noise(t) for t in ["Ah", "coche", "yani", "ঠিক", "  ", "um."])
    assert not any(
        is_voice_noise(t) for t in ["jaanini", "ଜାଣିନି", "I don't know", "9/59", "42", "not sure"]
    )
    store = MemoryTutorStore()
    s = TutorService(Q, FakeClassifier({}), store)  # everything → unclear
    sid = s.start("u", "ece-phase-error", "en", "noise-key-01")["sessionId"]
    before = len(store.events("u", sid))
    view = s.turn("u", sid, "noise-turn-01", "coche", None, "voice")
    assert view["route"]["label"] == "listening" and view["hintLevel"] == 0
    assert (
        view["brief"]["say"] == "Take your time. I'm listening."
        and len(store.events("u", sid)) == before
    )
    typed = s.turn("u", sid, "noise-turn-02", "coche", None, "text")  # typed text is never filtered
    assert typed["hintLevel"] == 1
    dont_know = s.turn("u", sid, "noise-turn-03", "jaanini", None, "voice")
    assert dont_know["hintLevel"] == 2


def test_voice_config_waits_through_thinking_pauses():
    from kiki_api.tutor.voice import PROMPT_VERSION, VOICE_PROMPT, live_config

    vad = live_config()["realtime_input_config"]["automatic_activity_detection"]
    assert vad["silence_duration_ms"] >= 1000 and PROMPT_VERSION == "voice.v2"
    assert "never speak Bengali" in VOICE_PROMPT and "filler" in VOICE_PROMPT


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
            s.speech("u", sid, "is it half")  # KiKi's transcript arrives while we classify
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
        s.turn("u", sid, "other-turn-01", None, "phase-does-not-matter", "text")  # moves the graph
        return real_commit(*args, **kw)

    store.commit = other_turn_first
    with pytest.raises(TutorError) as conflict:
        s.turn("u", sid, "race-turn-002", "weaker", None, "text")
    assert conflict.value.status == 409
