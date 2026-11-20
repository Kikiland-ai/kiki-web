"""Tutor content: a question is ordered stages; each stage is a small decision graph.

The graph decides every move. Models only label replies (classifier) and voice the
brief (Gemini Live). The whiteboard is cumulative: nodes, branches and hint rungs
reveal KiKi's items onto it, and a probe's answer items appear only once earned.
"""

from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StringConstraints, model_validator

from ..models import WireModel

SCHEMA = "kiki-tutor-question/v1"
EXIT = "$exit"  # a branch or show node pointing here completes its stage

Id = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9-]{0,63}$")]
Dim = Literal["concept", "words", "english", "lab"]
Level = Literal["ok", "partial", "not_yet"]
Rung = Literal["question", "nudge", "worked_step", "answer"]
RUNGS: tuple[Rung, ...] = ("question", "nudge", "worked_step", "answer")
SpeechMode = Literal["scripted", "guided"]


class Model(WireModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, populate_by_name=True, allow_inf_nan=False
    )


class LText(Model):
    """Learner-facing text. English is the source; other languages are optional renditions."""

    en: str = Field(min_length=1, max_length=600)
    or_: str | None = Field(default=None, alias="or", min_length=1, max_length=600)

    def get(self, lang: str) -> str:
        return (self.or_ if lang == "or" else None) or self.en


# ---------------------------------------------------------------- board items


class _Item(Model):
    id: Id


class QuestionItem(_Item):
    kind: Literal["question"]
    text: LText
    given: list[LText] = Field(default_factory=list, max_length=8)


class EquationItem(_Item):
    kind: Literal["equation"]
    tex: str = Field(min_length=1, max_length=400)
    label: LText | None = None


class StepItem(_Item):
    kind: Literal["step"]
    tex: str = Field(min_length=1, max_length=400)
    note: LText | None = None


class NoteItem(_Item):
    kind: Literal["note"]
    text: LText


class TermItem(_Item):
    kind: Literal["term"]
    termId: Id


class Tone(Model):
    """One cosine a·cos(2π f t + φ). Sums of tones draw DSB, AM, SSB and beat signals exactly."""

    a: float = Field(ge=-10, le=10)
    f: float = Field(ge=0, le=1e7)
    phaseDeg: float = Field(default=0, ge=-360, le=360)


class WaveSeries(Model):
    label: LText
    tones: list[Tone] = Field(min_length=1, max_length=12)
    style: Literal["reference", "signal", "envelope", "muted"] = "signal"


class WaveformParams(Model):
    series: list[WaveSeries] = Field(min_length=1, max_length=4)
    t: tuple[float, float]
    yRange: tuple[float, float]
    xLabel: LText | None = None
    yLabel: LText | None = None

    @model_validator(mode="after")
    def ranges(self):
        if not (self.t[0] < self.t[1] and self.yRange[0] < self.yRange[1]):
            raise ValueError("Ranges must increase")
        return self


class SpectrumLine(Model):
    f: float
    a: float = Field(ge=0)
    label: LText | None = None
    style: Literal["carrier", "sideband", "message", "muted"] = "sideband"


class SpectrumParams(Model):
    lines: list[SpectrumLine] = Field(min_length=1, max_length=16)
    fRange: tuple[float, float]
    unit: Literal["Hz", "kHz", "MHz"] = "kHz"
    bands: list[tuple[float, float]] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def in_range(self):
        lo, hi = self.fRange
        if not lo < hi or any(not lo <= line.f <= hi for line in self.lines):
            raise ValueError("Spectrum lines must lie inside an increasing fRange")
        return self


class Block(Model):
    id: Id
    label: LText
    kind: Literal["source", "multiplier", "filter", "gain", "adder", "oscillator", "output"]


class BlockEdge(Model):
    source: Id = Field(alias="from")
    to: Id
    label: str | None = Field(default=None, max_length=40)


class BlockParams(Model):
    blocks: list[Block] = Field(min_length=2, max_length=10)
    edges: list[BlockEdge] = Field(min_length=1, max_length=14)

    @model_validator(mode="after")
    def edges_known(self):
        ids = {b.id for b in self.blocks}
        if len(ids) != len(self.blocks):
            raise ValueError("Block ids must be unique")
        if any(e.source not in ids or e.to not in ids for e in self.edges):
            raise ValueError("Edges must join known blocks")
        return self


class WaveformFigure(_Item):
    kind: Literal["figure"]
    template: Literal["waveform"]
    params: WaveformParams
    caption: LText


class SpectrumFigure(_Item):
    kind: Literal["figure"]
    template: Literal["spectrum"]
    params: SpectrumParams
    caption: LText


class BlockFigure(_Item):
    kind: Literal["figure"]
    template: Literal["block"]
    params: BlockParams
    caption: LText


Figure = Annotated[WaveformFigure | SpectrumFigure | BlockFigure, Field(discriminator="template")]


class ResultItem(_Item):
    kind: Literal["result"]
    tex: str | None = Field(default=None, max_length=400)
    text: LText | None = None

    @model_validator(mode="after")
    def has_body(self):
        if not (self.tex or self.text):
            raise ValueError("A result needs tex or text")
        return self


BoardItem = Annotated[
    QuestionItem | EquationItem | StepItem | NoteItem | TermItem | Figure | ResultItem,
    Field(discriminator="kind"),
]


# ---------------------------------------------------------------- graph pieces

Anchor = Annotated[str, StringConstraints(pattern=r"^(enter|speech-end|say:.{2,60})$")]


class Reveal(Model):
    item: Id
    on: Anchor = "enter"


class Line(Model):
    """Something KiKi says, with what it uncovers on the board while saying it."""

    say: LText
    reveal: list[Reveal] = Field(default_factory=list, max_length=6)
    focus: list[Id] = Field(default_factory=list, max_length=4)


class Hint(Line):
    rung: Rung


class Branch(Model):
    id: Id                       # expect id, or a misconception id from the catalogue
    desc: str = Field(min_length=3, max_length=300)   # English, for the classifier and reviewers
    metric: Id
    level: Level
    next: str                    # node id in this stage, or EXIT
    reveal: list[Id] = Field(default_factory=list, max_length=6)   # earned on taking the branch
    ack: LText | None = None     # optional scripted acknowledgement


class Chip(Model):
    label: LText
    text: str = Field(min_length=1, max_length=200)
    route: Id                    # label it maps to; routes with no model call


class Node(Model):
    kind: Literal["probe", "show", "conclusion"]
    goal: str = Field(min_length=3, max_length=300)
    line: Line
    # probe only
    expect: list[Branch] = Field(default_factory=list, max_length=4)   # ok branch first
    misconceptions: list[Branch] = Field(default_factory=list, max_length=4)
    hints: list[Hint] = Field(default_factory=list, max_length=4)
    chips: list[Chip] = Field(default_factory=list, max_length=4)
    answerItems: list[Id] = Field(default_factory=list, max_length=6)
    mustNotReveal: list[str] = Field(default_factory=list, max_length=12)
    # show and conclusion
    next: str | None = None

    @model_validator(mode="after")
    def shape(self):
        if self.kind == "probe":
            if not self.expect:
                raise ValueError("A probe needs at least one expect branch")
            if [h.rung for h in self.hints] != list(RUNGS):
                raise ValueError("A probe needs the four hint rungs in order")
            if self.next is not None:
                raise ValueError("Probes move through branches, not next")
        else:
            if self.expect or self.misconceptions or self.hints or self.chips or self.answerItems:
                raise ValueError("Only probes have branches, hints, chips or answer items")
            if self.next is None:
                raise ValueError("Show and conclusion nodes need next")
        return self

    def branches(self) -> list[Branch]:
        return [*self.expect, *self.misconceptions]


class Stage(Model):
    id: Id
    title: LText
    conceptIds: list[Id] = Field(min_length=1, max_length=4)
    intro: Line
    start: Id
    nodes: dict[Id, Node] = Field(min_length=1, max_length=12)


# ---------------------------------------------------------------- question


class Metric(Model):
    id: Id
    label: LText
    dim: Dim


class Misconception(Model):
    id: Id
    desc: str = Field(min_length=3, max_length=300)
    conceptIds: list[Id] = Field(min_length=1, max_length=3)   # what to revise if it fires


class TargetTerm(Model):
    id: Id
    term: str = Field(min_length=2, max_length=60)
    alsoAccept: list[str] = Field(default_factory=list, max_length=4)
    meaning: LText | None = None


class SourceRef(Model):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    locator: str | None = Field(default=None, max_length=300)


class Review(Model):
    content: Literal["draft", "reviewed"]
    languages: dict[str, Literal["draft", "reviewed"]]


class NextStep(Model):
    kind: Literal["concept", "lab", "question"]
    id: Id
    why: LText
    whenMetric: Id | None = None
    whenLevel: Level | None = None
    whenMisconception: Id | None = None


class TutorQuestion(Model):
    schema_: Literal["kiki-tutor-question/v1"] = Field(alias="schema")
    id: Id
    version: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}\.\d+$")
    courseId: Id
    conceptIds: list[Id] = Field(min_length=1, max_length=8)
    difficulty: Literal["easy", "medium", "hard"]
    title: LText
    framing: LText                       # KiKi's spoken opening
    languages: list[Literal["en", "or"]] = Field(min_length=1)
    speech: dict[str, SpeechMode]        # per language
    review: Review
    metrics: list[Metric] = Field(min_length=1, max_length=8)
    misconceptions: list[Misconception] = Field(default_factory=list, max_length=12)
    terms: list[TargetTerm] = Field(default_factory=list, max_length=16)
    board: dict[Id, BoardItem] = Field(min_length=1, max_length=40)
    pinned: list[Id] = Field(min_length=1, max_length=3)   # shown at start (the question)
    stages: list[Stage] = Field(min_length=1, max_length=8)
    nextSteps: list[NextStep] = Field(default_factory=list, max_length=8)
    sources: list[SourceRef] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def ids_match(self):
        for key, item in self.board.items():
            if item.id != key:
                raise ValueError(f"Board key {key} differs from its item id")
        return self

    def stage(self, stage_id: str) -> Stage:
        for s in self.stages:
            if s.id == stage_id:
                return s
        raise KeyError(stage_id)
