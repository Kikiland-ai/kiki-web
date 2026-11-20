"""Classifier: offline contract tests always; live Gemini tests with KIKI_LIVE_GEMINI=1."""

import json
import os
from pathlib import Path

import pytest

from kiki_api.tutor import classifier as clf_mod
from kiki_api.tutor.classifier import (
    GeminiClassifier,
    build_prompt,
    parse,
    response_schema,
)
from kiki_api.tutor.content import TutorQuestion
from kiki_api.tutor.engine import allowed_labels, start, state_at, step
from kiki_api.tutor.session import OFF_TOPIC, UNCLEAR

ROOT = Path(__file__).resolve().parents[3]
QDIR = ROOT / "data-model/tutor/questions"
LIVE = os.environ.get("KIKI_LIVE_GEMINI") == "1"
MODEL = os.environ.get("KIKI_TUTOR_CLASSIFIER_MODEL", "gemini-3.5-flash-lite")


def load(name="ece-phase-error") -> TutorQuestion:
    return TutorQuestion.model_validate_json((QDIR / f"{name}.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------- offline


def test_prompt_and_schema_are_scoped_to_the_current_node():
    q = load()
    st = state_at(q, "calc-60")
    prompt, labels = build_prompt(q, st, "  cos 60 = 0.5  ")
    assert labels == ["half", "angle-unit-mixup", UNCLEAR, OFF_TOPIC]
    assert "`half`:" in prompt and "`angle-unit-mixup`:" in prompt
    assert "scaled-by-cos" not in prompt  # other nodes' labels never leak in
    assert "Use that factor. At 60°" in prompt and prompt.rstrip().endswith("cos 60 = 0.5")
    assert "local carrier" in prompt  # alsoAccept terms listed
    schema = response_schema(labels)
    assert schema["properties"]["label"]["enum"] == labels
    assert set(schema["required"]) == {"label", "quote", "confidence", "termsUsed", "clarity"}


def test_parse_accepts_a_good_answer():
    r = parse(
        json.dumps(
            {
                "label": "half",
                "quote": "0.5",
                "confidence": 1.4,
                "termsUsed": ["phase error"],
                "clarity": -1,
            }
        ),
        ["half", UNCLEAR, OFF_TOPIC],
        "cos 60 = 0.5",
        "voice",
    )
    assert (r.label, r.confidence, r.clarity, r.mode) == ("half", 1.0, None, "voice")


def test_parse_drops_the_quote_for_off_topic():
    r = parse(
        json.dumps(
            {"label": OFF_TOPIC, "quote": "lunch", "confidence": 0.9, "termsUsed": [], "clarity": 1}
        ),
        [OFF_TOPIC],
        "lunch?",
        "text",
    )
    assert r.quote is None and r.clarity == 1


@pytest.mark.parametrize("raw", ["", "not json", json.dumps({"label": "vanishes"}), "null"])
def test_parse_rejects_bad_output(raw):
    with pytest.raises((ValueError, AttributeError, TypeError)):
        parse(raw, ["half", UNCLEAR, OFF_TOPIC], "x", "text")


class _Boom:
    def __init__(self, exc):
        self.exc, self.calls = exc, 0

    def generate_content(self, **_):
        self.calls += 1
        raise self.exc


class _Text:
    def __init__(self, text):
        self.text = text

    def generate_content(self, **_):
        return self


def _clf(models, retries=0):
    c = GeminiClassifier(
        "only-key", "gemini-3.5-flash-lite", thinking=None, retries_on_429=retries, retry_sleep_s=0
    )
    c.clients._clients[0] = type("C", (), {"models": models})()  # inject a fake client for key 0
    return c


def test_provider_failure_degrades_to_unclear_never_raises():
    q = load()
    out = _clf(_Boom(TimeoutError())).classify(q, state_at(q, "calc-60"), "half", "text")
    assert out.reply.label == UNCLEAR and out.reply.confidence == 0 and out.error == "TimeoutError"


def test_label_outside_the_node_set_degrades_to_unclear():
    q = load()
    raw = json.dumps(
        {"label": "vanishes", "quote": "", "confidence": 1, "termsUsed": [], "clarity": 0}
    )
    out = _clf(_Text(raw)).classify(q, state_at(q, "calc-60"), "it vanishes", "text")
    assert out.reply.label == UNCLEAR and out.error == "ValueError"


def test_rate_limit_retries_then_gives_up(monkeypatch):
    monkeypatch.setattr(clf_mod.time, "sleep", lambda s: None)
    err = Exception("429")
    err.code = 429
    boom = _Boom(err)
    q = load()
    out = _clf(boom, retries=2).classify(q, state_at(q, "calc-60"), "half", "text")
    assert boom.calls == 3 and out.reply.label == UNCLEAR


# ---------------------------------------------------------------- live Gemini behaviour

live = pytest.mark.skipif(not LIVE, reason="set KIKI_LIVE_GEMINI=1 to call Gemini")


def _live_clf():
    from kiki_api.tutor.keys import load_keys

    return GeminiClassifier(
        load_keys(os.environ.get("KIKI_GEMINI_ENV_FILE")), MODEL, retries_on_429=4, retry_sleep_s=5
    )


@live
@pytest.mark.parametrize("name", ["ece-phase-error", "ece-dsb-receive-drift"])
def test_live_routing_accuracy(name):
    q = load(name)
    replies = json.loads((QDIR / f"{name}.routing.json").read_text(encoding="utf-8"))["replies"]
    c = _live_clf()
    misses = []
    for r in replies:
        out = c.classify(q, state_at(q, r["node"]), r["text"])
        assert out.error is None, out.error
        assert out.reply.label in allowed_labels(q, state_at(q, r["node"]))
        if out.reply.label != r["label"]:
            misses.append((r["node"], r["label"], out.reply.label, r["text"][:60]))
    accuracy = 1 - len(misses) / len(replies)
    assert accuracy >= 0.85, misses


@live
def test_live_free_text_session_reaches_the_scorecard():
    """Natural replies, real labels, the engine drives: every stage completes, evidence is right."""
    q = load()
    c = _live_clf()
    replies = {
        "predict-60": "I think only part of it comes back, it gets weaker but not zero",
        "why-cos": "the output gets multiplied by cos phi, so it is m(t) cos phi after the gain",
        "calc-60": "cos 60 degrees is 0.5 so half of the amplitude",
        "predict-90": "at 90 the cos is zero so the message disappears",
        "explain-english": (
            "Because the local carrier is out of phase by phi, after multiplying and the "
            "lowpass filter the output is m(t) cos phi, so 60 degrees gives half and 90 "
            "degrees gives nothing."
        ),
    }
    s = start(q, "en")
    events = list(s.events)
    while not s.done:
        node = s.state.node
        out = c.classify(q, s.state, replies[node], "text")
        s = step(q, s.state, out.reply)
        events += s.events
        assert s.state.turn <= 6, "a clean student should finish in five turns"
    concept = [e for e in events if e.type == "evidence" and e.basis == "branch"]
    assert [e.level for e in concept] == ["ok"] * 5
    assert any(e.basis == "terms" and "T-AM-07-1" in (e.termsUsed or []) for e in events)
    assert any(e.basis == "clarity" and e.level in ("ok", "partial") for e in events)


@live
def test_live_struggling_student_gets_hints_then_misconception_route():
    q = load()
    c = _live_clf()
    s = start(q, "en")
    s = step(q, s.state, c.classify(q, s.state, "umm I don't know", "text").reply)
    assert [e.rung for e in s.events if e.type == "hint_given"] == ["question"]
    s = step(
        q,
        s.state,
        c.classify(
            q, s.state, "all of it, the frequency is the same so phase doesn't matter", "text"
        ).reply,
    )
    ev = [e for e in s.events if e.type == "evidence" and e.basis == "branch"]
    assert ev and ev[0].misconception == "phase-does-not-matter"
    assert s.state.node == "why-cos"


@live
def test_live_odia_and_code_mixed_replies():
    q = load()
    c = _live_clf()
    st = state_at(q, "predict-60", "or")
    a = c.classify(q, st, "ଅଳ୍ପ ଫେରିବ, ପୁରା ନୁହେଁ, କିନ୍ତୁ ଶୂନ ବି ନୁହେଁ", "voice").reply
    assert a.label == "part-survives"
    b = c.classify(q, state_at(q, "calc-60"), "calculator re cos 60 -0.95 dekhauchi", "voice").reply
    assert b.label == "angle-unit-mixup"
