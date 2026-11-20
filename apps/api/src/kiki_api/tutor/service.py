"""Tutor service: questions registry + classifier + engine + store, behind the HTTP routes.

The client only ever receives board items that are already revealed, so answers cannot be
read ahead in devtools. Goal and forbidden phrases go to the browser only in guided mode,
where the voice model needs them to compose a line.
"""

import hashlib
import logging
import re
from pathlib import Path

from .classifier import Classifier
from .content import TutorQuestion
from .engine import EngineError, Step, start, step
from .session import Brief, Reply, TutorState
from .store import Conflict, Missing, TutorStore
from .validate import validate

logger = logging.getLogger("kiki_api.tutor")
QUESTIONS_DIR = Path(__file__).resolve().parents[5] / "data-model/tutor/questions"


class TutorError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def load_questions(directory: Path = QUESTIONS_DIR) -> dict[str, TutorQuestion]:
    out: dict[str, TutorQuestion] = {}
    for path in sorted(directory.glob("*.json")):
        if path.name.endswith(".routing.json"):
            continue
        q = TutorQuestion.model_validate_json(path.read_text(encoding="utf-8"))
        report = validate(q)
        if not report.ok:
            raise ValueError(f"Tutor question {path.name} is invalid: {report.errors[:3]}")
        out[q.id] = q
    return out


def session_id(uid: str, key: str) -> str:
    return "ts-" + hashlib.sha256(f"{uid}:{key}".encode()).hexdigest()[:24]


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


class TutorService:
    def __init__(self, questions: dict[str, TutorQuestion], classifier: Classifier, store: TutorStore):
        self.questions, self.classifier, self.store = questions, classifier, store

    # ---------------------------------------------------------------- views

    def question_view(self, qid: str) -> dict:
        q = self._question(qid)
        return {
            "id": q.id, "version": q.version, "title": _lt(q.title), "difficulty": q.difficulty,
            "conceptIds": q.conceptIds, "languages": q.languages,
            "review": q.review.model_dump(by_alias=True),
            "stages": [{"id": s.id, "title": _lt(s.title)} for s in q.stages],
            "metrics": [{"id": m.id, "label": _lt(m.label), "dim": m.dim} for m in q.metrics],
        }

    def _view(self, sid: str, q: TutorQuestion, state: TutorState, brief: Brief, revealed: list[str],
              route: dict | None, model_ms: int) -> dict:
        guided = brief.mode == "guided"
        node = q.stages[state.stageIndex].nodes[state.node]
        return {
            "sessionId": sid, "questionId": q.id, "status": state.status,
            "stageIndex": state.stageIndex, "stage": q.stages[state.stageIndex].id,
            "node": state.node, "hintLevel": state.hintLevel, "turn": state.turn, "lang": state.lang,
            "brief": {
                "mode": brief.mode, "lang": brief.lang, "expectsReply": brief.expectsReply,
                "say": brief.say,
                "segments": [s.model_dump(by_alias=True, exclude_none=True) for s in brief.segments],
                "cuePhrases": brief.cuePhrases,
                **({"goal": brief.goal, "mustNotReveal": brief.mustNotReveal,
                    "studentSaid": brief.studentSaid} if guided else {}),
            },
            "chips": [{"label": _lt(c.label), "route": c.route} for c in node.chips]
            if state.status == "active" else [],
            "board": [q.board[i].model_dump(by_alias=True, exclude_none=True) for i in state.board],
            "revealed": revealed,
            "route": route,
            "done": state.status == "completed",
            "timing": {"modelMs": model_ms},
        }

    # ---------------------------------------------------------------- actions

    def start(self, uid: str, qid: str, lang: str, key: str) -> dict:
        q = self._question(qid)
        sid = session_id(uid, key)
        try:
            first: Step = start(q, lang)
        except EngineError as exc:
            raise TutorError(422, str(exc)) from None
        view = self._view(sid, q, first.state, first.brief, first.revealed, None, 0)
        try:
            self.store.create(uid, sid, first.state, first.events, view)
        except Conflict:
            _, last = self.store.load(uid, sid)     # retried start: same session
            return last
        return view

    def get(self, uid: str, sid: str) -> dict:
        _, last = self._load(uid, sid)
        return last

    def turn(self, uid: str, sid: str, key: str, text: str | None, chip: str | None, mode: str) -> dict:
        try:
            replay = self.store.turn_response(uid, sid, key)
        except Missing:
            raise TutorError(404, "That tutor session does not exist.") from None
        if replay is not None:
            return replay
        state, _ = self._load(uid, sid)
        q = self._question(state.questionId)
        if state.status != "active":
            raise TutorError(409, "This session is complete.")
        node = q.stages[state.stageIndex].nodes[state.node]
        model_ms, route = 0, None
        if chip is not None:
            match = next((c for c in node.chips if c.route == chip), None)
            if match is None:
                raise TutorError(422, "That reply option is not available at this step.")
            reply = Reply(mode="chip", text=match.text, label=match.route)
        else:
            labelled = self.classifier.classify(q, state, text or "", mode)
            reply, model_ms = labelled.reply, labelled.model_ms
        route = {"label": reply.label, "confidence": reply.confidence, "quote": reply.quote,
                 "termsUsed": reply.termsUsed}
        try:
            nxt = step(q, state, reply)
        except EngineError as exc:
            raise TutorError(409, str(exc)) from None
        view = self._view(sid, q, nxt.state, nxt.brief, nxt.revealed, route, model_ms)
        try:
            return self.store.commit(uid, sid, state.version, nxt.state, nxt.events, key, view)
        except Conflict:
            raise TutorError(409, "Another reply changed this session. Reload to continue.") from None

    def speech(self, uid: str, sid: str, text: str) -> dict:
        """KiKi's spoken transcript for the last brief: log any forbidden phrase it said."""
        state, _ = self._load(uid, sid)
        q = self._question(state.questionId)
        if state.status != "active":
            return {"leaks": []}
        node = q.stages[state.stageIndex].nodes[state.node]
        said = _norm(text)
        leaks = [p for p in node.mustNotReveal if _norm(p) in said]
        if leaks:
            from .session import Event

            events = [Event(seq=state.seq + i, type="speech_leak", stage=q.stages[state.stageIndex].id,
                            node=state.node, turn=state.turn, phrase=p) for i, p in enumerate(leaks)]
            new = state.model_copy(update={"seq": state.seq + len(leaks), "version": state.version + 1})
            try:
                self.store.append(uid, sid, state.version, new, events)
            except Conflict:
                logger.info("Speech leak log skipped: session moved on")
        return {"leaks": leaks}

    def events(self, uid: str, sid: str):
        self._load(uid, sid)
        return self.store.events(uid, sid)

    # ---------------------------------------------------------------- helpers

    def _question(self, qid: str) -> TutorQuestion:
        try:
            return self.questions[qid]
        except KeyError:
            raise TutorError(404, "That tutor question does not exist.") from None

    def _load(self, uid, sid):
        try:
            return self.store.load(uid, sid)
        except Missing:
            raise TutorError(404, "That tutor session does not exist.") from None


def _lt(text) -> dict:
    return text.model_dump(by_alias=True, exclude_none=True)
