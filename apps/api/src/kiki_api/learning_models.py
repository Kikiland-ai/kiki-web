"""Public learning DTOs. Private bank fields never enter assigned-question responses."""

from typing import Literal

from pydantic import Field, model_validator

from .media_models import MediaExperience
from .models import WireModel
from .teaching_visuals import DsbVisual

PLAN = "LP-ANALOG-MODULATION"
COURSE = "CRS-AC-ECE"
PRACTICAL = "PR-AM-DSB"
CONCEPTS = [f"C-AM-{n:02}" for n in range(1, 11)]
LAB_CONCEPTS = [CONCEPTS[n - 1] for n in [1, 2, 3, 4, 6, 7, 8]]
CHAPTER_ASSESSMENT = "AS-AM-CHAPTER"


class Text(WireModel):
    en: str = Field(min_length=1)
    or_: str = Field(alias="or", min_length=1)


class Source(WireModel):
    origin: str
    label: str
    url: str | None = None


class ChapterConcept(WireModel):
    id: str
    order: int
    broadConceptId: str
    title: Text
    canDo: str
    prerequisiteIds: list[str]
    requiredForLab: bool
    estMinutes: int
    assessmentId: str


class BroadConcept(WireModel):
    id: str
    title: Text
    order: int


class Review(WireModel):
    content: Literal["draft", "reviewed"]
    odia: Literal["draft", "reviewed"]


class Chapter(WireModel):
    planId: Literal["LP-ANALOG-MODULATION"]
    courseId: Literal["CRS-AC-ECE"]
    title: Text
    broadConcepts: list[BroadConcept]
    concepts: list[ChapterConcept] = Field(min_length=10, max_length=10)
    chapterAssessmentId: Literal["AS-AM-CHAPTER"]
    practicalId: Literal["PR-AM-DSB"]
    review: Review

    @model_validator(mode="after")
    def valid_graph(self):
        if [c.id for c in self.concepts] != CONCEPTS:
            raise ValueError("Expected the ten ordered concepts")
        groups = {b.id for b in self.broadConcepts}
        for i, c in enumerate(self.concepts):
            if (
                c.broadConceptId not in groups
                or c.assessmentId != f"AS-AM-{i + 1:02}"
                or c.requiredForLab != (c.id in LAB_CONCEPTS)
                or any(p not in CONCEPTS[:i] for p in c.prerequisiteIds)
            ):
                raise ValueError("Invalid concept mapping/prerequisites")
        return self


class Placard(WireModel):
    id: str
    kind: Literal["definition", "concept", "application", "recap"]
    title: Text
    body: Text
    termIds: list[str]
    sources: list[Source]


class Term(WireModel):
    id: str
    term: str
    definition: str
    pronunciationOr: str
    glossOr: str
    example: Text


class Example(WireModel):
    title: Text
    scenario: Text
    takeaway: Text


class Media(WireModel):
    status: Literal["none"]


class Lesson(WireModel):
    conceptId: str
    planId: Literal["LP-ANALOG-MODULATION"]
    title: Text
    keyIdea: Text
    placards: list[Placard] = Field(min_length=4, max_length=4)
    terms: list[Term]
    example: Example
    media: Media
    assessmentId: str
    visual: DsbVisual | None = None
    mediaExperience: MediaExperience | None = None

    @model_validator(mode="after")
    def valid_cards(self):
        if [p.kind for p in self.placards] != ["definition", "concept", "application", "recap"]:
            raise ValueError("Expected four ordered placards")
        if len({p.id for p in self.placards}) != 4 or any(
            term not in {t.id for t in self.terms} for p in self.placards for term in p.termIds
        ):
            raise ValueError("Invalid placard/term membership")
        return self


class Position(WireModel):
    placardId: str = Field(min_length=1, max_length=128)
    updatedAt: str


class PositionUpdate(WireModel):
    placardId: str = Field(min_length=1, max_length=128)


class Check(WireModel):
    status: Literal["not_attempted", "revisit", "passed"]
    latestRunId: str | None = None
    attemptPercent: float | None = None


class ConceptProgress(WireModel):
    conceptId: str
    status: Literal["not_started", "learning", "revisit", "passed"]
    theoryCheck: Check
    position: Position | None = None


class Coverage(WireModel):
    done: int
    total: int


class Rings(WireModel):
    concept: Coverage | None
    words: Coverage | None = None
    english: Coverage | None = None
    lab: Coverage | None = None


class LabReadiness(WireModel):
    practicalId: Literal["PR-AM-DSB"]
    ready: bool
    requiredConceptIds: list[str]
    missingConceptIds: list[str]
    evidenceRunIds: list[str]
    chapterTestRequired: Literal[False] = False


class Progress(WireModel):
    ownerLearnerId: str
    planId: Literal["LP-ANALOG-MODULATION"]
    concepts: list[ConceptProgress]
    chapterTest: Check
    rings: Rings
    labReadiness: LabReadiness


class Choice(WireModel):
    questionId: str = Field(min_length=1, max_length=128)
    optionIndex: int = Field(ge=0, le=20)


class Question(WireModel):
    questionId: str
    conceptId: str
    prompt: Text
    options: dict[Literal["en", "or"], list[str]]

    @model_validator(mode="after")
    def valid_options(self):
        if set(self.options) != {"en", "or"} or not (
            2 <= len(self.options["en"]) == len(self.options["or"]) <= 20
        ):
            raise ValueError("Equivalent bilingual options required")
        return self


class Run(WireModel):
    ownerLearnerId: str
    runId: str
    assessmentId: str
    scope: Literal["concept", "chapter"]
    attemptNumber: int = Field(ge=1)
    passPercent: Literal[60, 80]
    questions: list[Question]
    contentVersion: str
    revision: int = Field(ge=0)
    status: Literal["in_progress", "submitted"]
    responses: list[Choice]
    currentQuestionIndex: int = Field(ge=0)
    origin: Literal["student_attempt"]
    createdAt: str

    @model_validator(mode="after")
    def consistent_assignment(self):
        chapter = self.assessmentId == CHAPTER_ASSESSMENT
        total = 10 if chapter else 5
        expected_id = "C-AM-" + self.assessmentId[-2:]
        questions = {q.questionId: q for q in self.questions}
        if (
            self.scope != ("chapter" if chapter else "concept")
            or self.passPercent != (80 if chapter else 60)
            or len(self.questions) != total
            or len(questions) != total
            or self.currentQuestionIndex >= total
            or (chapter and {q.conceptId for q in self.questions} != set(CONCEPTS))
            or (
                not chapter
                and (
                    expected_id not in CONCEPTS
                    or any(q.conceptId != expected_id for q in self.questions)
                )
            )
            or len({r.questionId for r in self.responses}) != len(self.responses)
            or (self.status == "submitted" and len(self.responses) != total)
        ):
            raise ValueError("Inconsistent immutable assignment")
        for r in self.responses:
            if r.questionId not in questions or r.optionIndex >= len(
                questions[r.questionId].options["en"]
            ):
                raise ValueError("Invalid saved response")
        return self


class Breakdown(WireModel):
    correct: int
    total: int
    missedQuestionIds: list[str]


class Feedback(WireModel):
    questionId: str
    correct: bool
    explanation: Text


class Result(WireModel):
    ownerLearnerId: str
    contentVersion: str
    runId: str
    assessmentId: str
    correct: int
    total: Literal[5, 10]
    percent: float
    passPercent: Literal[60, 80]
    passed: bool
    byConcept: dict[str, Breakdown]
    revisitConceptIds: list[str]
    nextAction: Literal["continue", "revisit_then_retry"]
    feedback: list[Feedback]
    completedAt: str

    @model_validator(mode="after")
    def consistent_score(self):
        if (
            not 0 <= self.correct <= self.total
            or self.passPercent != (60 if self.total == 5 else 80)
            or self.percent != self.correct / self.total * 100
            or self.passed != (self.correct * 100 >= self.passPercent * self.total)
            or self.nextAction != ("continue" if self.passed else "revisit_then_retry")
            or len(self.feedback) != self.total
            or len({f.questionId for f in self.feedback}) != self.total
            or sum(f.correct for f in self.feedback) != self.correct
            or sum(g.correct for g in self.byConcept.values()) != self.correct
            or sum(g.total for g in self.byConcept.values()) != self.total
            or any(
                g.total < 1
                or not 0 <= g.correct <= g.total
                or len(g.missedQuestionIds) != g.total - g.correct
                for g in self.byConcept.values()
            )
        ):
            raise ValueError("Inconsistent assessment result")
        return self


class OverviewConcept(WireModel):
    conceptId: str
    assessmentId: str
    title: str
    status: Literal["not_attempted", "passed", "revisit"]
    latestRunId: str | None
    percent: float | None


class Attempt(WireModel):
    run: Run
    result: Result | None


class Overview(WireModel):
    ownerLearnerId: str
    planId: Literal["LP-ANALOG-MODULATION"]
    contentVersion: str
    concepts: list[OverviewConcept]
    chapterAllowed: bool
    chapterMissingConceptIds: list[str]
    labReady: bool
    labMissingConceptIds: list[str]
    chapterTestRequired: Literal[False] = False
    attempts: list[Attempt]


class Start(WireModel):
    assessmentId: str = Field(min_length=1, max_length=128)
    previousRunId: str | None = Field(default=None, min_length=1, max_length=128)


class Submission(WireModel):
    responses: list[Choice] = Field(max_length=10)


class Draft(Submission):
    currentQuestionIndex: int = Field(ge=0, le=9)
    expectedRevision: int = Field(ge=0)


class ChapterEnvelope(WireModel):
    chapter: Chapter


class LessonEnvelope(WireModel):
    lesson: Lesson


class ProgressEnvelope(WireModel):
    progress: Progress


class PositionEnvelope(WireModel):
    position: ConceptProgress


class RunEnvelope(WireModel):
    run: Run


class ResultEnvelope(WireModel):
    result: Result


class OverviewEnvelope(WireModel):
    overview: Overview
