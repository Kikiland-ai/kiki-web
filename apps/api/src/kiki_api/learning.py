"""Firestore-backed learning, owner-scoped positions and authoritative assessment state."""

import re
from datetime import UTC, datetime
from uuid import uuid4

from firebase_admin import firestore
from pydantic import Field

from .backend import BoundaryError
from .learning_catalog import digest, dump
from .learning_models import (
    CHAPTER_ASSESSMENT,
    CONCEPTS,
    COURSE,
    LAB_CONCEPTS,
    PLAN,
    PRACTICAL,
    Chapter,
    Check,
    ConceptProgress,
    Draft,
    Lesson,
    Overview,
    Position,
    Progress,
    Question,
    Result,
    Run,
    Start,
    Submission,
)
from .models import WireModel
from .teaching_visuals import project_dsb_visual


def now():
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class Latest(WireModel):
    runId: str
    passed: bool
    percent: float = Field(ge=0, le=100)


class State(WireModel):
    schema_: str = Field(default="learning-state/v1", alias="schema")
    ownerLearnerId: str
    contentVersion: str
    positions: dict[str, Position] = Field(default_factory=dict)
    latestChecks: dict[str, Latest] = Field(default_factory=dict)
    activeRuns: dict[str, str] = Field(default_factory=dict)
    attemptCounts: dict[str, int] = Field(default_factory=dict)
    recentRunIds: list[str] = Field(default_factory=list)


class FirestoreLearning:
    def __init__(self, client, profiles, media=None):
        self.client, self.profiles, self.media = client, profiles, media

    def access(self, uid):
        if COURSE not in self.profiles.get(uid).courseIds:
            raise BoundaryError(403, "Add Analog Communication to your subjects first.")

    def context(self, uid, plan_id=PLAN):
        self.access(uid)
        if plan_id != PLAN:
            raise BoundaryError(404, "This chapter was not found.")
        head = self.client.document(f"learningCatalog/{PLAN}").get(timeout=5)
        version = head.to_dict().get("currentVersion") if head.exists else None
        if not isinstance(version, str) or not re.fullmatch(r"am-[a-f0-9]{24}", version):
            raise BoundaryError(503, "The teaching catalog is not available yet.")
        root = self.client.document(f"learningCatalog/{PLAN}/versions/{version}")
        manifest = self.read(root)
        if (
            manifest.get("contentVersion") != version
            or manifest.get("schema") != "learning-catalog/v1"
        ):
            raise BoundaryError(503, "The teaching catalog needs a compatibility check.")
        chapter = Chapter.model_validate(self.read(root.collection("chapters").document(PLAN)))
        return version, root, chapter

    @staticmethod
    def read(ref, transaction=None):
        snapshot = ref.get(transaction=transaction, timeout=5)
        if not snapshot.exists:
            raise BoundaryError(404, "This learning record was not found.")
        return snapshot.to_dict()

    def owner_ref(self, uid, collection, name):
        return (
            self.client.collection("learners").document(uid).collection(collection).document(name)
        )

    def state_ref(self, uid, version):
        return self.owner_ref(uid, "learningStates", f"{PLAN}-{version}")

    def state(self, uid, version, transaction=None):
        snapshot = self.state_ref(uid, version).get(transaction=transaction, timeout=5)
        if not snapshot.exists:
            return dump(State(ownerLearnerId=uid, contentVersion=version))
        state = State.model_validate(snapshot.to_dict())
        allowed = {f"AS-AM-{n:02}" for n in range(1, 11)} | {CHAPTER_ASSESSMENT}
        if (
            state.schema_ != "learning-state/v1"
            or state.ownerLearnerId != uid
            or state.contentVersion != version
            or any(c not in CONCEPTS for c in state.positions)
            or any(
                a not in allowed
                for a in [*state.latestChecks, *state.activeRuns, *state.attemptCounts]
            )
        ):
            raise BoundaryError(503, "Your learning state needs a compatibility check.")
        return dump(state)

    def chapter(self, uid, plan_id):
        return self.context(uid, plan_id)[2]

    def lesson(self, uid, concept_id):
        version, root, _ = self.context(uid)
        lesson = self._lesson(root, concept_id)
        # Published media is only referenced here; a lesson read never prepares media.
        media = self.media.experience(version, lesson) if self.media else None
        return lesson.model_copy(update={"mediaExperience": media}) if media else lesson

    def _media(self, uid, concept_id):
        version, root, _ = self.context(uid)
        if self.media is None:
            raise BoundaryError(503, "Lesson media storage is not available yet.")
        lesson = self._lesson(root, concept_id)
        source = self.read(root.collection("sourceConcepts").document(concept_id))
        return version, lesson, source

    def media_manifest(self, uid, concept_id):
        return self.media.manifest(*self._media(uid, concept_id))

    def media_asset(self, uid, concept_id, revision, asset_id):
        return self.media.asset(*self._media(uid, concept_id), revision, asset_id)

    def _lesson(self, root, concept_id):
        if concept_id not in CONCEPTS:
            raise BoundaryError(404, "This concept was not found.")
        lesson = Lesson.model_validate(self.read(root.collection("lessons").document(concept_id)))
        if lesson.conceptId != concept_id:
            raise BoundaryError(503, "The lesson needs a compatibility check.")
        if concept_id == "C-AM-04":
            source = self.read(root.collection("sourceConcepts").document(concept_id))
            visual = project_dsb_visual(source)
            if not {visual.sidebandTermId, visual.carrierTermId, visual.signalTermId} <= {
                t.id for t in lesson.terms
            }:
                raise BoundaryError(503, "The visual glossary needs a compatibility check.")
            lesson = lesson.model_copy(update={"visual": visual})
        return lesson

    @staticmethod
    def readiness(chapter, state):
        rows = []
        for c in chapter.concepts:
            check = state["latestChecks"].get(c.assessmentId)
            rows.append(
                {
                    "conceptId": c.id,
                    "assessmentId": c.assessmentId,
                    "title": c.title.en,
                    "status": ("passed" if check["passed"] else "revisit")
                    if check
                    else "not_attempted",
                    "latestRunId": check["runId"] if check else None,
                    "percent": check["percent"] if check else None,
                }
            )
        missing = [c["conceptId"] for c in rows if c["status"] != "passed"]
        lab_missing = [c for c in missing if c in LAB_CONCEPTS]
        return rows, missing, lab_missing

    @staticmethod
    def concept_progress(concept_id, state):
        check = state["latestChecks"].get("AS-AM-" + concept_id[-2:])
        position = state["positions"].get(concept_id)
        status = ("passed" if check["passed"] else "revisit") if check else "not_attempted"
        return ConceptProgress.model_validate(
            {
                "conceptId": concept_id,
                "status": status if check else "learning" if position else "not_started",
                "theoryCheck": {
                    "status": status,
                    **(
                        {"latestRunId": check["runId"], "attemptPercent": check["percent"]}
                        if check
                        else {}
                    ),
                },
                **({"position": position} if position else {}),
            }
        )

    def progress(self, uid, plan_id):
        version, _, chapter = self.context(uid, plan_id)
        state = self.state(uid, version)
        rows, _, lab_missing = self.readiness(chapter, state)
        concepts = [dump(self.concept_progress(c.id, state)) for c in chapter.concepts]
        latest_chapter = state["latestChecks"].get(CHAPTER_ASSESSMENT)
        chapter_check = Check(status="not_attempted")
        if latest_chapter:
            chapter_check = Check(
                status="passed" if latest_chapter["passed"] else "revisit",
                latestRunId=latest_chapter["runId"],
                attemptPercent=latest_chapter["percent"],
            )
        return Progress.model_validate(
            {
                "ownerLearnerId": uid,
                "planId": PLAN,
                "concepts": concepts,
                "chapterTest": dump(chapter_check),
                "rings": {
                    "concept": {"done": sum(c["status"] == "passed" for c in rows), "total": 10}
                    if any(c["status"] != "not_attempted" for c in rows)
                    else None,
                    "words": None,
                    "english": None,
                    "lab": None,
                },
                "labReadiness": {
                    "practicalId": PRACTICAL,
                    "ready": not lab_missing,
                    "requiredConceptIds": LAB_CONCEPTS,
                    "missingConceptIds": lab_missing,
                    "evidenceRunIds": [
                        c["latestRunId"]
                        for c in rows
                        if c["conceptId"] in LAB_CONCEPTS and c["status"] == "passed"
                    ],
                    "chapterTestRequired": False,
                },
            }
        )

    def save_position(self, uid, concept_id, placard_id):
        version, root, _ = self.context(uid)
        lesson = self._lesson(root, concept_id)
        if placard_id not in [p.id for p in lesson.placards]:
            raise BoundaryError(422, "This placard does not belong to the concept.")

        @firestore.transactional
        def apply(transaction):
            state = self.state(uid, version, transaction)
            saved = state["positions"].get(concept_id)
            if saved and saved["placardId"] == placard_id:
                return self.concept_progress(concept_id, state)
            state["positions"][concept_id] = {"placardId": placard_id, "updatedAt": now()}
            transaction.set(self.state_ref(uid, version), state)
            return self.concept_progress(concept_id, state)

        return apply(self.client.transaction(max_attempts=3))

    def _record(self, uid, run_id, transaction=None):
        if not re.fullmatch(r"run-[a-f0-9-]{36}", run_id):
            raise BoundaryError(404, "This attempt was not found.")
        record = self.read(self.owner_ref(uid, "assessmentRuns", run_id), transaction)
        run = Run.model_validate(record["run"])
        if run.ownerLearnerId != uid or run.runId != run_id:
            raise BoundaryError(503, "The attempt needs an ownership check.")
        if record["result"] is not None:
            result = Result.model_validate(record["result"])
            if (
                result.ownerLearnerId != uid
                or result.runId != run_id
                or result.contentVersion != run.contentVersion
            ):
                raise BoundaryError(503, "The result needs an ownership check.")
        return record

    def get_run(self, uid, run_id):
        self.access(uid)
        return Run.model_validate(self._record(uid, run_id)["run"])

    def get_result(self, uid, run_id):
        self.access(uid)
        record = self._record(uid, run_id)
        if record["result"] is None:
            raise BoundaryError(409, "This attempt has not been submitted.")
        return Result.model_validate(record["result"])

    def operation(self, uid, key, path, body, transaction):
        if not key or not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", key):
            raise BoundaryError(422, "A valid Idempotency-Key is required.")
        ref = self.owner_ref(uid, "learningOperations", digest(key))
        fingerprint = digest({"path": path, "body": body})
        saved = ref.get(transaction=transaction, timeout=5)
        if saved.exists:
            data = saved.to_dict()
            if data["fingerprint"] != fingerprint:
                raise BoundaryError(409, "This operation key belongs to a different request.")
            if data["receipt"].get("ownerLearnerId") != uid:
                raise BoundaryError(503, "The operation needs an ownership check.")
            return ref, fingerprint, data["receipt"]
        return ref, fingerprint, None

    @staticmethod
    def receipt(transaction, ref, fingerprint, receipt):
        transaction.create(ref, {"fingerprint": fingerprint, "receipt": receipt})

    def start(self, uid, body: Start, key):
        version, root, chapter = self.context(uid)
        allowed = [c.assessmentId for c in chapter.concepts] + [CHAPTER_ASSESSMENT]
        if body.assessmentId not in allowed:
            raise BoundaryError(404, "This assessment was not found.")
        bank = self.read(root.collection("privateAssessments").document(body.assessmentId))
        run_id = "run-" + str(uuid4())

        @firestore.transactional
        def apply(transaction):
            op, fingerprint, saved = self.operation(uid, key, "start", dump(body), transaction)
            if saved:
                return Run.model_validate(saved)
            state = self.state(uid, version, transaction)
            if body.previousRunId:
                previous = self._record(uid, body.previousRunId, transaction)
                if (
                    previous["run"]["assessmentId"] != body.assessmentId
                    or previous["run"]["contentVersion"] != version
                    or previous["result"] is None
                ):
                    raise BoundaryError(
                        409, "Retry must reference a completed check in this version."
                    )
            active = state["activeRuns"].get(body.assessmentId)
            if active:
                run = self._record(uid, active, transaction)["run"]
                self.receipt(transaction, op, fingerprint, run)
                return Run.model_validate(run)
            if body.assessmentId == CHAPTER_ASSESSMENT and self.readiness(chapter, state)[1]:
                raise BoundaryError(409, "Pass all ten concept checks before the chapter test.")
            number = state["attemptCounts"].get(body.assessmentId, 0) + 1
            run = dump(
                Run(
                    ownerLearnerId=uid,
                    runId=run_id,
                    assessmentId=body.assessmentId,
                    scope=bank["scope"],
                    attemptNumber=number,
                    passPercent=bank["passPercent"],
                    questions=[
                        Question.model_validate(
                            {k: q[k] for k in ["questionId", "conceptId", "prompt", "options"]}
                        )
                        for q in bank["questions"]
                    ],
                    contentVersion=version,
                    revision=0,
                    status="in_progress",
                    responses=[],
                    currentQuestionIndex=0,
                    origin="student_attempt",
                    createdAt=now(),
                )
            )
            keys = {
                q["questionId"]: {
                    "correctIndex": q["correctIndex"],
                    "explanation": q["explanation"],
                }
                for q in bank["questions"]
            }
            state["attemptCounts"][body.assessmentId] = number
            state["activeRuns"][body.assessmentId] = run_id
            state["recentRunIds"] = [run_id, *state["recentRunIds"]][:15]
            transaction.create(
                self.owner_ref(uid, "assessmentRuns", run_id),
                {"run": run, "result": None, "privateKeys": keys},
            )
            transaction.set(self.state_ref(uid, version), state)
            self.receipt(transaction, op, fingerprint, run)
            return Run.model_validate(run)

        return apply(self.client.transaction(max_attempts=3))

    @staticmethod
    def validate_responses(run, responses, complete=False):
        questions = {q["questionId"]: q for q in run["questions"]}
        if len({r.questionId for r in responses}) != len(responses) or (
            complete and len(responses) != len(questions)
        ):
            raise BoundaryError(422, "Answer each assigned question once.")
        for r in responses:
            if r.questionId not in questions or r.optionIndex >= len(
                questions[r.questionId]["options"]["en"]
            ):
                raise BoundaryError(422, "Invalid assigned question or option.")

    def draft(self, uid, run_id, body: Draft, key):
        self.access(uid)

        @firestore.transactional
        def apply(transaction):
            op, fingerprint, saved = self.operation(
                uid, key, "draft/" + run_id, dump(body), transaction
            )
            if saved:
                return Run.model_validate(saved)
            record = self._record(uid, run_id, transaction)
            run = record["run"]
            if run["status"] != "in_progress" or body.expectedRevision != run["revision"]:
                raise BoundaryError(409, "The saved attempt changed. Reopen before editing.")
            self.validate_responses(run, body.responses)
            if body.currentQuestionIndex >= len(run["questions"]):
                raise BoundaryError(422, "Invalid question position.")
            run.update(
                responses=[dump(r) for r in body.responses],
                currentQuestionIndex=body.currentQuestionIndex,
                revision=run["revision"] + 1,
            )
            transaction.set(self.owner_ref(uid, "assessmentRuns", run_id), record)
            self.receipt(transaction, op, fingerprint, run)
            return Run.model_validate(run)

        return apply(self.client.transaction(max_attempts=3))

    @staticmethod
    def score(run, keys, responses):
        chosen = {r.questionId: r.optionIndex for r in responses}
        groups, feedback = {}, []
        for q in run["questions"]:
            qid, cid = q["questionId"], q["conceptId"]
            correct = chosen[qid] == keys[qid]["correctIndex"]
            group = groups.setdefault(cid, {"correct": 0, "total": 0, "missedQuestionIds": []})
            group["total"] += 1
            group["correct"] += int(correct)
            if not correct:
                group["missedQuestionIds"].append(qid)
            feedback.append(
                {"questionId": qid, "correct": correct, "explanation": keys[qid]["explanation"]}
            )
        correct = sum(f["correct"] for f in feedback)
        total = len(feedback)
        passed = correct * 100 >= run["passPercent"] * total
        return dump(
            Result.model_validate(
                {
                    **{
                        k: run[k]
                        for k in [
                            "ownerLearnerId",
                            "contentVersion",
                            "runId",
                            "assessmentId",
                            "passPercent",
                        ]
                    },
                    "correct": correct,
                    "total": total,
                    "percent": correct / total * 100,
                    "passed": passed,
                    "byConcept": groups,
                    "feedback": feedback,
                    "revisitConceptIds": [
                        cid for cid, g in groups.items() if g["correct"] < g["total"]
                    ],
                    "nextAction": "continue" if passed else "revisit_then_retry",
                    "completedAt": now(),
                }
            )
        )

    def submit(self, uid, run_id, body: Submission, key):
        self.access(uid)

        @firestore.transactional
        def apply(transaction):
            op, fingerprint, saved = self.operation(
                uid, key, "submit/" + run_id, dump(body), transaction
            )
            if saved:
                return Result.model_validate(saved)
            record = self._record(uid, run_id, transaction)
            run = record["run"]
            self.validate_responses(run, body.responses, complete=True)
            if record["result"]:
                existing = {r["questionId"]: r["optionIndex"] for r in run["responses"]}
                if existing != {r.questionId: r.optionIndex for r in body.responses}:
                    raise BoundaryError(409, "A submitted attempt cannot be changed.")
                self.receipt(transaction, op, fingerprint, record["result"])
                return Result.model_validate(record["result"])
            state = self.state(uid, run["contentVersion"], transaction)
            result = self.score(run, record["privateKeys"], body.responses)
            record["result"] = result
            run.update(
                status="submitted",
                responses=[dump(r) for r in body.responses],
                revision=run["revision"] + 1,
            )
            state["latestChecks"][run["assessmentId"]] = {
                "runId": run_id,
                "passed": result["passed"],
                "percent": result["percent"],
            }
            if state["activeRuns"].get(run["assessmentId"]) == run_id:
                del state["activeRuns"][run["assessmentId"]]
            transaction.set(self.owner_ref(uid, "assessmentRuns", run_id), record)
            transaction.set(self.state_ref(uid, run["contentVersion"]), state)
            self.receipt(transaction, op, fingerprint, result)
            return Result.model_validate(result)

        return apply(self.client.transaction(max_attempts=3))

    def overview(self, uid, plan_id):
        version, _, chapter = self.context(uid, plan_id)
        state = self.state(uid, version)
        rows, missing, lab_missing = self.readiness(chapter, state)
        # Bounded payload; summaries remain authoritative beyond this history window.
        ids = list(dict.fromkeys([*state["activeRuns"].values(), *state["recentRunIds"]]))
        attempts = []
        for run_id in ids:
            record = self._record(uid, run_id)
            if record["run"]["contentVersion"] != version:
                raise BoundaryError(503, "Your history needs a compatibility check.")
            attempts.append({"run": record["run"], "result": record["result"]})
        attempts.sort(key=lambda a: a["run"]["createdAt"], reverse=True)
        return Overview.model_validate(
            {
                "ownerLearnerId": uid,
                "planId": PLAN,
                "contentVersion": version,
                "concepts": rows,
                "chapterAllowed": not missing,
                "chapterMissingConceptIds": missing,
                "labReady": not lab_missing,
                "labMissingConceptIds": lab_missing,
                "chapterTestRequired": False,
                "attempts": attempts,
            }
        )
