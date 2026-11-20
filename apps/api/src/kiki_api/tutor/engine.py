"""The decision engine: a pure function over (question, state, labelled reply).

No I/O and no model calls. Given the same inputs it returns the same state, events
and brief, so a session can be replayed from its log. Show nodes and stage changes
chain into one brief, so KiKi says "explanation, next stage, next question" in one go.
"""

import re
from dataclasses import dataclass, field

from .content import EXIT, Branch, Node, Reveal as ContentReveal, TutorQuestion
from .session import (
    OFF_TOPIC,
    UNCLEAR,
    Brief,
    Event,
    Reply,
    Reveal,
    Segment,
    TutorState,
)

MAX_CHAIN = 64   # defensive bound; validated content is acyclic


class EngineError(Exception):
    """The request does not fit the session (completed, or not waiting for a reply)."""


@dataclass
class Step:
    state: TutorState
    events: list[Event]
    brief: Brief
    revealed: list[str] = field(default_factory=list)   # new board items, in order

    @property
    def done(self) -> bool:
        return self.state.status == "completed"


class _Run:
    def __init__(self, q: TutorQuestion, state: TutorState):
        self.q, self.s = q, state.model_copy(deep=True)
        self.events: list[Event] = []
        self.segments: list[Segment] = []
        self.revealed: list[str] = []

    # -- helpers
    @property
    def stage(self):
        return self.q.stages[self.s.stageIndex]

    @property
    def node(self) -> Node:
        return self.stage.nodes[self.s.node]

    def emit(self, type_, **fields):
        fields.setdefault("stage", self.stage.id if self.s.stageIndex < len(self.q.stages) else None)
        self.events.append(Event(seq=self.s.seq, type=type_, turn=self.s.turn, **fields))
        self.s.seq += 1

    def reveal(self, items: list[ContentReveal] | list[str], node: str | None = None) -> list[Reveal]:
        out = []
        for r in items:
            item, on = (r, "enter") if isinstance(r, str) else (r.item, r.on)
            if item in self.s.board:
                continue
            self.s.board.append(item)
            self.revealed.append(item)
            out.append(Reveal(item=item, on=on))
        if out:
            self.emit("item_revealed", node=node, items=out)
        return out

    def text(self, lt) -> str:
        return lt.get(self.s.lang)

    def say(self, kind, line_say, reveals=(), node=None, focus=()):
        self.segments.append(
            Segment(kind=kind, node=node, say=self.text(line_say), reveals=list(reveals), focus=list(focus))
        )

    # -- movement
    def enter_stage(self, index: int):
        self.s.stageIndex = index
        stage = self.stage
        self.emit("stage_entered")
        rv = self.reveal(stage.intro.reveal)
        self.say("intro", stage.intro.say, rv, focus=stage.intro.focus)
        self.enter_node(stage.start)

    def enter_node(self, nid: str):
        for _ in range(MAX_CHAIN):
            if nid == EXIT:
                return self.exit_stage()
            self.s.node, self.s.hintLevel = nid, 0
            node = self.node
            self.emit("node_entered", node=nid)
            rv = self.reveal(node.line.reveal, nid)
            kind = {"probe": "probe", "show": "show", "conclusion": "conclusion"}[node.kind]
            self.say(kind, node.line.say, rv, nid, node.line.focus)
            if node.kind == "probe":
                return
            nid = node.next
        raise EngineError("Graph chain too long")

    def exit_stage(self):
        self.emit("stage_completed", node=self.s.node)
        if self.s.stageIndex + 1 < len(self.q.stages):
            return self.enter_stage(self.s.stageIndex + 1)
        self.s.status = "completed"
        self.emit("session_completed", node=self.s.node)

    def take(self, branch: Branch, reply: Reply | None, basis: str, level=None):
        metric = next(m for m in self.q.metrics if m.id == branch.metric)
        node = self.s.node
        self.emit(
            "evidence", node=node, metric=metric.id, dim=metric.dim, level=level or branch.level,
            quote=reply.quote if reply else None, basis=basis, label=branch.id,
            misconception=branch.id if branch in self.node.misconceptions else None,
        )
        self.emit("move", node=node, move="forced" if basis == "forced" else "branch", label=branch.id)
        rv = self.reveal(branch.reveal, node)
        if branch.ack or rv:
            self.segments.append(
                Segment(kind="ack", node=node, say=self.text(branch.ack) if branch.ack else "", reveals=rv)
            )
        self.enter_node(branch.next)

    # -- turn evidence (words, expression) from free speech or text
    def turn_evidence(self, reply: Reply):
        if reply.mode in ("chip", "none"):
            return
        node = self.s.node
        if reply.termsUsed:
            used = _match_terms(self.q, reply.termsUsed)
            words = next((m for m in self.q.metrics if m.dim == "words"), None)
            if words and used:
                self.emit("evidence", node=node, metric=words.id, dim="words", level="ok",
                          termsUsed=used, basis="terms", quote=reply.quote)
        if reply.clarity is not None:
            expr = next((m for m in self.q.metrics if m.dim == "english"), None)
            if expr:
                level = {2: "ok", 1: "partial", 0: "not_yet"}[reply.clarity]
                self.emit("evidence", node=node, metric=expr.id, dim="english", level=level,
                          basis="clarity", quote=reply.quote)

    def brief(self, studentSaid: str | None) -> Brief:
        waiting = self.s.status == "active"
        node = self.node if waiting else None
        return Brief(
            mode=self.q.speech.get(self.s.lang, "scripted"),
            lang=self.s.lang,
            segments=[s for s in self.segments if s.say or s.reveals],
            goal=node.goal if node else "Close the session warmly.",
            studentSaid=studentSaid,
            mustNotReveal=list(node.mustNotReveal) if node else [],
            expectsReply=waiting,
        )

    def result(self, studentSaid=None) -> Step:
        self.s.version += 1
        return Step(self.s, self.events, self.brief(studentSaid), self.revealed)


def _norm(text: str) -> str:
    return " " + re.sub(r"[^a-z0-9]+", " ", text.lower()).strip() + " "


def _match_terms(q: TutorQuestion, said: list[str]) -> list[str]:
    """Credit each spoken phrase to the term whose longest form it contains as whole words."""
    forms = [(_norm(f), t.id) for t in q.terms for f in (t.term, *t.alsoAccept)]
    forms.sort(key=lambda pair: -len(pair[0]))
    hits: list[str] = []
    for phrase in said:
        p = _norm(phrase)
        for form, tid in forms:
            if form in p:
                if tid not in hits:
                    hits.append(tid)
                break
    return [t.id for t in q.terms if t.id in hits]


def allowed_labels(q: TutorQuestion, state: TutorState) -> list[str]:
    node = q.stages[state.stageIndex].nodes[state.node]
    return [b.id for b in node.branches()] + [UNCLEAR, OFF_TOPIC]


def start(q: TutorQuestion, lang: str) -> Step:
    if lang not in q.languages:
        raise EngineError(f"Language {lang} is not offered for this question")
    first = q.stages[0]
    state = TutorState(
        questionId=q.id, questionVersion=q.version, lang=lang, stageIndex=0, node=first.start,
        hintLevel=0, turn=0, status="active", board=[], seq=0, version=0,
    )
    run = _Run(q, state)
    run.emit("session_started")
    rv = run.reveal(q.pinned)
    run.say("framing", q.framing, rv)
    run.enter_stage(0)
    return run.result()


def step(q: TutorQuestion, state: TutorState, reply: Reply) -> Step:
    if state.questionId != q.id or state.questionVersion != q.version:
        raise EngineError("The session belongs to a different question version")
    if state.status != "active":
        raise EngineError("The session is already complete")
    run = _Run(q, state)
    node = run.node
    if node.kind != "probe":
        raise EngineError("The session is not waiting for a reply")
    run.s.turn += 1
    run.emit("student_turn", node=state.node, mode=reply.mode, text=reply.text or None)
    branches = {b.id: b for b in node.branches()}
    label = reply.label if reply.label in branches or reply.label in (UNCLEAR, OFF_TOPIC) else UNCLEAR
    run.emit(
        "labelled", node=state.node, label=label, confidence=reply.confidence,
        quote=reply.quote, termsUsed=reply.termsUsed or None, mode=reply.mode,
    )
    run.turn_evidence(reply)
    said = reply.quote or (reply.text if reply.mode != "chip" else None) or None

    if label in branches:
        run.take(branches[label], reply, "branch")
    elif label == OFF_TOPIC:
        run.emit("move", node=state.node, move="restate")
        run.say("restate", node.line.say, node=state.node)
    elif run.s.hintLevel < len(node.hints):
        hint = node.hints[run.s.hintLevel]
        run.s.hintLevel += 1
        run.emit("hint_given", node=state.node, rung=hint.rung)
        run.emit("move", node=state.node, move="hint")
        rv = run.reveal(hint.reveal, state.node)
        run.say("hint", hint.say, rv, state.node, hint.focus)
    else:
        run.take(node.expect[0], None, "forced", level="not_yet")
    return run.result(said)
