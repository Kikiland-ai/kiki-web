"""Decision engine: exhaustive walks over every question file plus targeted behaviour tests."""

from pathlib import Path

import pytest

from kiki_api.tutor.content import TutorQuestion
from kiki_api.tutor.engine import EngineError, allowed_labels, start, step
from kiki_api.tutor.session import OFF_TOPIC, UNCLEAR, Reply

ROOT = Path(__file__).resolve().parents[3]
FILES = [p for p in sorted((ROOT / "data-model/tutor/questions").glob("*.json"))
         if not p.name.endswith(".routing.json")]
PHASE = ROOT / "data-model/tutor/questions/ece-phase-error.json"


def load(path=PHASE) -> TutorQuestion:
    return TutorQuestion.model_validate_json(path.read_text(encoding="utf-8"))


def chip(label):
    return Reply(mode="chip", text="(chip)", label=label)


def say(label, text="free text", **kw):
    return Reply(mode="text", text=text, label=label, quote=text, **kw)


def probe_of(q, state):
    return q.stages[state.stageIndex].nodes[state.node]


def board_from_events(events):
    board = []
    for e in events:
        if e.type == "item_revealed":
            board.extend(r.item for r in e.items)
    return board


# ---------------------------------------------------------------- exhaustive walk


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.stem)
def test_exhaustive_walk_keeps_every_invariant(path):
    q = load(path)
    probes = sum(1 for s in q.stages for n in s.nodes.values() if n.kind == "probe")
    max_turns = probes * 7 + 2
    first = start(q, "en")
    seen, stack, completions, states = set(), [(first.state, list(first.events), 0)], 0, 0
    while stack:
        state, log, off = stack.pop()
        states += 1
        # invariants on every waiting state
        assert board_from_events(log) == state.board, "log must replay to the board"
        assert [e.seq for e in log] == list(range(len(log))), "event seq is contiguous"
        assert len(set(state.board)) == len(state.board)
        if state.status == "completed":
            completions += 1
            assert log[-1].type == "session_completed"
            continue
        assert state.turn <= max_turns, "a session must terminate"
        node = probe_of(q, state)
        assert node.kind == "probe"
        if state.hintLevel < 4:
            leaked = set(node.answerItems) & set(state.board)
            assert not leaked, f"{state.node}: answer on board before earned: {leaked}"
        key = (state.stageIndex, state.node, state.hintLevel, tuple(state.board), off)
        if key in seen:
            continue
        seen.add(key)
        labels = [b.id for b in node.branches()] + [UNCLEAR]
        if off == 0:
            labels.append(OFF_TOPIC)
        for label in labels:
            nxt = step(q, state, say(label))
            assert nxt.state.seq == state.seq + len(nxt.events)
            assert nxt.brief.segments, "every step says something"
            if nxt.state.status == "active":
                assert nxt.brief.expectsReply and probe_of(q, nxt.state).kind == "probe"
            stack.append((nxt.state, log + nxt.events, off + (label == OFF_TOPIC)))
    assert completions > 0 and states > 10


# ---------------------------------------------------------------- targeted behaviour


def test_start_frames_and_asks_the_first_probe():
    q = load()
    s = start(q, "en")
    kinds = [seg.kind for seg in s.brief.segments]
    assert kinds == ["framing", "intro", "probe"]
    assert s.state.board == ["q"] and s.state.node == "predict-60"
    assert s.brief.expectsReply and "half" in s.brief.mustNotReveal
    assert [e.type for e in s.events][:3] == ["session_started", "item_revealed", "stage_entered"]


def test_correct_chips_complete_in_five_turns_with_all_ok():
    q = load()
    s = start(q, "en")
    events = list(s.events)
    for label in ["part-survives", "scaled-by-cos", "half", "vanishes", "clear-explanation"]:
        assert label in allowed_labels(q, s.state)
        s = step(q, s.state, chip(label))
        events += s.events
    assert s.done and s.state.turn == 5 and not s.brief.expectsReply
    levels = {e.metric: e.level for e in events if e.type == "evidence"}
    assert set(levels.values()) == {"ok"}
    assert "result" in s.state.board and s.state.board[0] == "q"
    assert [e.stage for e in events if e.type == "stage_completed"] == [
        "predict", "mechanism", "calculate", "extend", "articulate"]


def test_one_reply_chains_ack_next_stage_intro_and_next_question():
    q = load()
    s = step(q, start(q, "en").state, chip("part-survives"))
    kinds = [seg.kind for seg in s.brief.segments]
    assert kinds == ["ack", "intro", "probe"]           # reveal traces-60, mechanism intro, why-cos
    assert s.revealed[:3] == ["traces-60", "rx", "mix"]
    assert s.state.node == "why-cos"


def test_misconception_routes_through_show_node_and_logs_it():
    q = load()
    s = step(q, start(q, "en").state, chip("phase-does-not-matter"))
    assert [seg.kind for seg in s.brief.segments] == ["show", "intro", "probe"]
    ev = [e for e in s.events if e.type == "evidence"][0]
    assert ev.misconception == "phase-does-not-matter" and ev.level == "not_yet"


def test_hint_ladder_then_forced_advance():
    q = load()
    s = start(q, "en")
    s = step(q, s.state, chip("part-survives"))       # to why-cos
    rungs = []
    for _ in range(4):
        s = step(q, s.state, say(UNCLEAR))
        rungs += [e.rung for e in s.events if e.type == "hint_given"]
        assert s.state.node == "why-cos"
    assert rungs == ["question", "nudge", "worked_step", "answer"]
    assert {"identity", "lpf-out", "gain-out"} <= set(s.state.board)   # ladder uncovered the steps
    s = step(q, s.state, say(UNCLEAR))
    ev = [e for e in s.events if e.type == "evidence"][0]
    assert (ev.basis, ev.level, ev.label) == ("forced", "not_yet", "scaled-by-cos")
    assert s.state.node == "calc-60"


def test_off_topic_restates_without_spending_a_hint():
    q = load()
    s0 = start(q, "en")
    s = step(q, s0.state, say(OFF_TOPIC, "what's for lunch"))
    assert s.state.node == "predict-60" and s.state.hintLevel == 0
    assert [seg.kind for seg in s.brief.segments] == ["restate"]
    assert s.state.board == s0.state.board


def test_invalid_label_is_treated_as_unclear():
    q = load()
    s = step(q, start(q, "en").state, say("vanishes"))   # not a predict-60 label
    assert [e.label for e in s.events if e.type == "labelled"] == [UNCLEAR]
    assert [e.rung for e in s.events if e.type == "hint_given"] == ["question"]


def test_chips_earn_no_words_or_expression_evidence_but_free_text_does():
    q = load()
    s0 = start(q, "en")
    c = step(q, s0.state, Reply(mode="chip", text="Part of it", label="part-survives",
                                termsUsed=["phase error"], clarity=2))
    assert {e.dim for e in c.events if e.type == "evidence"} == {"concept"}
    t = step(q, s0.state, say("part-survives", "part of it, the phase error shrinks it",
                              termsUsed=["Phase Error", "xyz"], clarity=1))
    ev = {e.basis: e for e in t.events if e.type == "evidence"}
    assert ev["terms"].termsUsed == ["T-AM-08-1"] and ev["terms"].dim == "words"
    assert ev["clarity"].level == "partial" and ev["clarity"].dim == "english"


def test_local_carrier_counts_as_local_oscillator():
    q = load()
    t = step(q, start(q, "en").state, say("part-survives", termsUsed=["local carrier"]))
    assert [e.termsUsed for e in t.events if e.basis == "terms"] == [["T-AM-06-2"]]


def test_deterministic_replay():
    q = load()
    a, b = start(q, "or"), start(q, "or")
    assert a.state == b.state and a.events == b.events and a.brief == b.brief
    a2, b2 = step(q, a.state, say(UNCLEAR)), step(q, b.state, say(UNCLEAR))
    assert a2.state == b2.state and a2.events == b2.events


def test_odia_session_uses_odia_lines_where_present():
    q = load()
    s = start(q, "or")
    probe = [seg for seg in s.brief.segments if seg.kind == "probe"][0]
    assert probe.say == q.stages[0].nodes["predict-60"].line.say.or_
    intro = [seg for seg in s.brief.segments if seg.kind == "intro"][0]
    assert intro.say == q.stages[0].intro.say.en            # no Odia rendition yet: falls back


def test_state_is_not_mutated():
    q = load()
    s0 = start(q, "en")
    before = s0.state.model_copy(deep=True)
    step(q, s0.state, chip("part-survives"))
    assert s0.state == before


def test_errors():
    q = load()
    with pytest.raises(EngineError):
        start(q, "hi")
    s = start(q, "en")
    with pytest.raises(EngineError):
        step(q, s.state.model_copy(update={"questionVersion": "2020-01-01.1"}), chip("part-survives"))
    done = s
    for label in ["part-survives", "scaled-by-cos", "half", "vanishes", "clear-explanation"]:
        done = step(q, done.state, chip(label))
    with pytest.raises(EngineError):
        step(q, done.state, chip("half"))
