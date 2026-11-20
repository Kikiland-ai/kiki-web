"""Runtime models: session state, a labelled reply, the speech brief and log events.

The server owns state. The append-only event log is the source for the board,
the scorecard and the post-session analysis.
"""

from typing import Literal

from pydantic import Field

from .content import Dim, Level, Model, SpeechMode

InputMode = Literal["text", "voice", "chip", "none"]
Move = Literal[
    "start", "advance", "branch", "hint", "forced", "restate", "stage-exit", "complete"
]
EventType = Literal[
    "session_started",
    "stage_entered",
    "node_entered",
    "student_turn",
    "labelled",
    "hint_given",
    "item_revealed",
    "evidence",
    "move",
    "stage_completed",
    "session_completed",
    "speech_leak",
]

UNCLEAR = "unclear"
OFF_TOPIC = "off_topic"


class TutorState(Model):
    questionId: str
    questionVersion: str
    lang: Literal["en", "or"]
    stageIndex: int = Field(ge=0)
    node: str
    hintLevel: int = Field(ge=0, le=4)   # rungs already given at this node
    turn: int = Field(ge=0)
    status: Literal["active", "completed"]
    board: list[str]                     # revealed item ids, in reveal order
    seq: int = Field(ge=0)               # next event sequence number
    version: int = Field(ge=0)           # bumps on every write (optimistic concurrency)


class Reply(Model):
    """What the student said, already labelled against the current node's allowed set."""

    mode: InputMode
    text: str = Field(default="", max_length=2000)
    label: str
    confidence: float = Field(default=1.0, ge=0, le=1)
    quote: str | None = Field(default=None, max_length=400)
    termsUsed: list[str] = Field(default_factory=list, max_length=12)
    clarity: int | None = Field(default=None, ge=0, le=2)   # expression quality, free text only


class Reveal(Model):
    item: str
    on: str


class Segment(Model):
    """One spoken piece, in order: an ack, a show explanation, a stage intro, the next question."""

    kind: Literal["framing", "ack", "intro", "show", "probe", "hint", "restate", "conclusion"]
    node: str | None = None
    say: str
    reveals: list[Reveal] = Field(default_factory=list)   # anchors are relative to this segment
    focus: list[str] = Field(default_factory=list)


class Brief(Model):
    """What the voice layer (or text UI) delivers next. The graph wrote it; no model chose it."""

    mode: SpeechMode
    lang: Literal["en", "or"]
    segments: list[Segment]
    goal: str
    studentSaid: str | None = None
    mustNotReveal: list[str] = Field(default_factory=list)
    expectsReply: bool

    @property
    def say(self) -> str:
        return " ".join(s.say for s in self.segments)

    @property
    def cuePhrases(self) -> list[str]:
        return [r.on[4:] for s in self.segments for r in s.reveals if r.on.startswith("say:")]


class Event(Model):
    seq: int = Field(ge=0)
    type: EventType
    stage: str | None = None
    node: str | None = None
    turn: int = Field(ge=0)
    move: Move | None = None
    mode: InputMode | None = None
    text: str | None = None
    label: str | None = None
    confidence: float | None = None
    quote: str | None = None
    termsUsed: list[str] | None = None
    rung: str | None = None
    items: list[Reveal] | None = None
    metric: str | None = None
    dim: Dim | None = None
    level: Level | None = None
    misconception: str | None = None
    basis: Literal["branch", "forced", "terms", "clarity"] | None = None
    phrase: str | None = None
