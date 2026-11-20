"""Post-session analysis over real engine logs, the report route, and (live) the model summary."""

import os

import pytest

from kiki_api.tutor.analysis import FakeSummarizer, GeminiSummarizer, analyse, combine
from kiki_api.tutor.classifier import FakeClassifier
from kiki_api.tutor.engine import start, step
from kiki_api.tutor.service import TutorService, load_concept_titles, load_questions
from kiki_api.tutor.session import UNCLEAR, Reply
from kiki_api.tutor.store import MemoryTutorStore

Q = load_questions()
PHASE = Q["ece-phase-error"]


def run(replies, lang="en"):
    s = start(PHASE, lang)
    events = list(s.events)
    for r in replies:
        s = step(PHASE, s.state, r)
        events += s.events
    return s, events


def chip(label):
    return Reply(mode="chip", text="(chip)", label=label)


def text(label, quote="x", **kw):
    return Reply(mode="text", text=quote, label=label, quote=quote, **kw)


def test_combine():
    assert combine([]) == "n/a" and combine(["ok", "ok"]) == "ok"
    assert combine(["not_yet"]) == "not_yet" and combine(["ok", "not_yet"]) == "partial"
    assert combine(["partial"]) == "partial"


def test_clean_chip_session():
    s, ev = run(
        [
            chip(x)
            for x in ["part-survives", "scaled-by-cos", "half", "vanishes", "clear-explanation"]
        ]
    )
    rep = analyse(PHASE, ev)
    levels = {m["id"]: m["level"] for m in rep["metrics"]}
    assert levels == {
        "conceptual-understanding": "ok",
        "calculation-accuracy": "ok",
        "terms": "n/a",
        "articulation": "ok",
    }
    assert rep["revise"] == [] and rep["strengthen"] == [] and rep["completed"]
    assert [n["id"] for n in rep["next"]] == ["CP-DSB-11"]
    assert rep["sheet"] == s.state.board and rep["turns"] == 5 and rep["hints"] == 0


def test_struggling_session_names_what_to_revise():
    replies = [
        text("part-survives", "part of it"),
        text(UNCLEAR),
        text(UNCLEAR),
        text(UNCLEAR),
        text(UNCLEAR),
        text(UNCLEAR),  # forced at why-cos
        text("angle-unit-mixup", "-0.95 on my calculator"),
        text(UNCLEAR),
        text("vanishes", "cos 90 is zero"),  # one hint at 90
        text("partial-explanation", "phase error makes it smaller", clarity=1),
    ]
    _, ev = run(replies)
    rep = analyse(PHASE, ev)
    stages = {s["id"]: s for s in rep["stages"]}
    assert stages["mechanism"]["forced"] and stages["mechanism"]["hints"] == 4
    assert stages["calculate"]["misconceptions"] == ["angle-unit-mixup"]
    assert stages["extend"]["hints"] == 1 and stages["extend"]["level"] == "ok"
    revise = {r["concept"] for r in rep["revise"]}
    assert {"C-AM-01", "C-AM-06", "C-AM-08"} <= revise
    assert not ({r["concept"] for r in rep["strengthen"]} & revise)
    levels = {m["id"]: m["level"] for m in rep["metrics"]}
    assert levels["conceptual-understanding"] == "partial"
    assert levels["calculation-accuracy"] == "partial"
    assert levels["articulation"] == "partial"
    assert levels["terms"] == "not_yet"  # free text, no course terms
    assert {n["id"] for n in rep["next"]} == {"CP-DSB-11", "C-AM-01"}
    quotes = next(m for m in rep["metrics"] if m["id"] == "calculation-accuracy")["quotes"]
    assert "-0.95 on my calculator" in quotes


def test_terms_used_in_free_text_count_as_words_evidence():
    replies = [
        text("part-survives", "x", termsUsed=["phase error", "local carrier"]),
        text("scaled-by-cos", "y", termsUsed=["lowpass filter"]),
    ]
    _, ev = run(replies)
    words = next(m for m in analyse(PHASE, ev)["metrics"] if m["id"] == "terms")
    assert words["level"] == "ok" and set(words["termsUsed"]) == {
        "T-AM-08-1",
        "T-AM-06-2",
        "T-AM-07-1",
    }


def test_report_route_caches_summary_once_and_adds_titles():
    store, summ = MemoryTutorStore(), FakeSummarizer("Nice work.")
    svc = TutorService(Q, FakeClassifier({}), store, summ)
    sid = svc.start("u", "ece-phase-error", "en", "k-start-1")["sessionId"]
    mid = svc.report("u", sid)
    assert mid["completed"] is False and mid["summary"] is None and summ.calls == 0
    svc.turn("u", sid, "k-turn-01", None, "part-survives", "text")
    for i in range(5):
        svc.turn("u", sid, f"k-unc-{i:02d}", "hmm", None, "text")  # forced at why-cos
    for i, c in enumerate(["half", "vanishes", "partial-explanation"]):
        svc.turn("u", sid, f"k-chip-{i:02d}", None, c, "text")
    rep = svc.report("u", sid)
    again = svc.report("u", sid)
    assert rep["completed"] and rep["summary"] == "Nice work." and summ.calls == 1 and again == rep
    titles = {r["concept"]: r["title"] for r in rep["revise"]}
    assert titles["C-AM-06"] == load_concept_titles()["C-AM-06"]
    assert [i["id"] for i in rep["board"]] == rep["sheet"]


def test_a_metric_quotes_the_step_that_judged_it_first():
    """Live run, 20 Nov: 'Explaining in English' quoted the first power answer (a clarity score)."""
    replies = [
        text("part-survives", "part of it", clarity=2),
        text("scaled-by-cos"),
        text("half"),
        text("vanishes"),
        text(
            "clear-explanation",
            "Because the local carrier is out of phase the output is m(t) cos phi",
            clarity=2,
        ),
    ]
    _, ev = run(replies)
    art = next(m for m in analyse(PHASE, ev)["metrics"] if m["id"] == "articulation")
    assert art["quotes"][0].startswith("Because the local carrier") and len(art["quotes"]) == len(
        set(art["quotes"])
    )


def test_the_gemini_summary_never_changes_the_report():
    """Regression (live run, 20 Nov): trimming quotes for the model removed them from the report."""
    import copy

    _, ev = run([text("part-survives", "part of it"), text("scaled-by-cos", "times cos phi")])
    rep = analyse(PHASE, ev)
    before = copy.deepcopy(rep)

    class Models:
        def generate_content(self, **kw):
            return type("R", (), {"text": "Good work."})()

    summ = GeminiSummarizer("k", "gemini-3.5-flash-lite")
    summ.clients._clients[0] = type("C", (), {"models": Models()})()
    assert summ.summarise(PHASE, rep, "en", {}) == "Good work."
    assert rep == before and all("quotes" in m for m in rep["metrics"])


def test_summary_failure_keeps_the_report():
    store = MemoryTutorStore()
    svc = TutorService(Q, FakeClassifier({}), store, FakeSummarizer(None))
    sid = svc.start("u", "ece-phase-error", "en", "k-start-2")["sessionId"]
    for i, c in enumerate(
        ["part-survives", "scaled-by-cos", "half", "vanishes", "partial-explanation"]
    ):
        svc.turn("u", sid, f"k-c-{i:04d}", None, c, "text")
    rep = svc.report("u", sid)
    assert rep["summary"] is None and rep["metrics"]


@pytest.mark.skipif(os.environ.get("KIKI_LIVE_GEMINI") != "1", reason="set KIKI_LIVE_GEMINI=1")
def test_live_summary_uses_only_report_facts():
    replies = [
        text("part-survives"),
        text("scaled-by-cos"),
        text("angle-unit-mixup", "-0.95"),
        text("vanishes"),
        text("clear-explanation", clarity=2),
    ]
    _, ev = run(replies)
    rep = analyse(PHASE, ev)
    from kiki_api.tutor.keys import load_keys

    out = GeminiSummarizer(
        load_keys(os.environ.get("KIKI_GEMINI_ENV_FILE")),
        os.environ.get("KIKI_TUTOR_CLASSIFIER_MODEL", "gemini-3.5-flash-lite"),
    ).summarise(PHASE, rep, "en", {"C-AM-01": "Amplitude, frequency and phase"})
    assert out and len(out) < 1200
    assert "wrong" not in out.lower()
    assert "Amplitude, frequency and phase" in out or "C-AM-01" in out or "angle" in out.lower()
