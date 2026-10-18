"""Preparation only. Aditya's future observation/assessment service owns execution evidence."""

import re
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Depends, Query
from firebase_admin import firestore
from pydantic import Field, model_validator

from .backend import BoundaryError
from .learning import FirestoreLearning, now
from .learning_catalog import dump
from .learning_models import LAB_CONCEPTS, PLAN, PRACTICAL, Chapter, LabReadiness, Source, Text
from .models import Identity, WireModel


class Checkpoint(WireModel):
    id: str
    stepNumber: int
    targetLabel: str
    instruction: Text
    why: Text
    expected: str
    evidenceKind: str
    prerequisiteCheckpointIds: list[str]


class Practical(WireModel):
    practicalId: Literal["PR-AM-DSB"]
    planId: Literal["LP-ANALOG-MODULATION"]
    contentVersion: str
    title: str
    aim: str
    softwareName: str
    softwareUrl: Literal["https://matlab.mathworks.com/"]
    predictionPrompt: str
    observationPrompts: list[Text]
    checkpoints: list[Checkpoint] = Field(min_length=12, max_length=12)
    sources: list[Source]
    reviewStatus: Literal["draft", "reviewed"]

    @model_validator(mode="after")
    def ordered_checkpoints(self):
        if [c.stepNumber for c in self.checkpoints] != list(range(1, 13)) or len(
            {c.id for c in self.checkpoints}
        ) != 12:
            raise ValueError("Expected twelve ordered unique checkpoints")
        return self


class StartPreparation(WireModel):
    practicalId: Literal["PR-AM-DSB"]


class PreparationDraft(WireModel):
    expectedRevision: int = Field(ge=0)
    currentCheckpointId: str = Field(min_length=1, max_length=128)
    prediction: str = Field(max_length=3000)
    projectRef: str = Field(max_length=500)
    observationNotes: dict[str, str]

    @model_validator(mode="after")
    def bounded_notes(self):
        if len(self.observationNotes) > 2 or any(
            key not in {"0", "1"} or len(value) > 3000
            for key, value in self.observationNotes.items()
        ):
            raise ValueError("Use only the supplied observation prompts")
        return self


class PreparationRecord(WireModel):
    schema_: Literal["lab-preparation/v1"] = Field(alias="schema")
    id: str
    ownerLearnerId: str
    practicalId: Literal["PR-AM-DSB"]
    contentVersion: str = Field(pattern=r"^am-[a-f0-9]{24}$")
    revision: int = Field(ge=0)
    currentCheckpointId: str
    prediction: str = Field(max_length=3000)
    projectRef: str = Field(max_length=500)
    observationNotes: dict[str, str]
    createdAt: str
    updatedAt: str


class Monitoring(WireModel):
    status: Literal[
        "pending_integration", "connecting", "active", "paused", "disconnected", "completed"
    ] = "pending_integration"
    pointerActive: Literal[False] = False
    assessmentStatus: Literal["not_assessed"] = "not_assessed"


class Preparation(PreparationRecord):
    readiness: LabReadiness
    monitoring: Monitoring
    sessionPath: str
    practical: Practical


class PracticalEnvelope(WireModel):
    practical: Practical


class PreparationEnvelope(WireModel):
    preparation: Preparation


class ActiveEnvelope(WireModel):
    preparation: Preparation | None


def project_practical(content, manifest, version):
    ledger, case = content["ledger"], content["case"]
    return Practical.model_validate(
        {
            "practicalId": PRACTICAL,
            "planId": PLAN,
            "contentVersion": version,
            "title": ledger["title"],
            "aim": ledger["aim"],
            "softwareName": case["software"]["name"],
            "softwareUrl": case["software"]["url"],
            "predictionPrompt": ledger["predictionPrompt"],
            "observationPrompts": case["observationPrompts"],
            "checkpoints": [
                {
                    **{
                        k: cp[k]
                        for k in [
                            "id",
                            "stepNumber",
                            "instruction",
                            "why",
                            "expected",
                            "evidenceKind",
                            "prerequisiteCheckpointIds",
                        ]
                    },
                    "targetLabel": cp["target"]["label"],
                }
                for cp in case["checkpoints"]
            ],
            "sources": case["sources"],
            "reviewStatus": manifest["review"]["content"],
        }
    )


class LabPreparations:
    def __init__(self, learning: FirestoreLearning):
        self.learning, self.client = learning, learning.client
        self.execution_status = None

    def practical(self, uid, practical_id):
        if practical_id != PRACTICAL:
            raise BoundaryError(404, "This experiment was not found.")
        version, root, _ = self.learning.context(uid)
        return self.project(root, version)

    def project(self, root, version):
        content = self.learning.read(root.collection("practicals").document(PRACTICAL))
        manifest = self.learning.read(root)
        return project_practical(content, manifest, version)

    def ref(self, uid, session_id):
        if not re.fullmatch(r"prep-[a-f0-9-]{36}", session_id):
            raise BoundaryError(404, "This lab preparation was not found.")
        return self.learning.owner_ref(uid, "labPreparations", session_id)

    def record(self, uid, session_id, transaction=None):
        record = PreparationRecord.model_validate(
            self.learning.read(self.ref(uid, session_id), transaction)
        )
        if record.ownerLearnerId != uid or record.id != session_id:
            raise BoundaryError(503, "Your lab preparation needs an ownership check.")
        return record

    def view(self, record):
        root = self.client.document(f"learningCatalog/{PLAN}/versions/{record.contentVersion}")
        practical = self.project(root, record.contentVersion)
        if record.currentCheckpointId not in {c.id for c in practical.checkpoints}:
            raise BoundaryError(503, "Your lab position needs a compatibility check.")
        chapter = Chapter.model_validate(
            self.learning.read(root.collection("chapters").document(PLAN))
        )
        state = self.learning.state(record.ownerLearnerId, record.contentVersion)
        rows, _, missing = self.learning.readiness(chapter, state)
        return Preparation.model_validate(
            {
                **dump(record),
                "practical": dump(practical),
                "readiness": {
                    "practicalId": PRACTICAL,
                    "ready": not missing,
                    "requiredConceptIds": LAB_CONCEPTS,
                    "missingConceptIds": missing,
                    "evidenceRunIds": [
                        c["latestRunId"]
                        for c in rows
                        if c["conceptId"] in LAB_CONCEPTS and c["status"] == "passed"
                    ],
                    "chapterTestRequired": False,
                },
                "monitoring": {
                    "status": self.execution_status(record.ownerLearnerId, record.id)
                    if self.execution_status
                    else "pending_integration",
                    "pointerActive": False,
                    "assessmentStatus": "not_assessed",
                },
                "sessionPath": f"/labs/{record.id}",
            }
        )

    def get(self, uid, session_id):
        self.learning.access(uid)
        return self.view(self.record(uid, session_id))

    def active(self, uid, practical_id):
        practical = self.practical(uid, practical_id)
        head = self.learning.owner_ref(uid, "labPreparationHeads", practical.contentVersion).get(
            timeout=5
        )
        return self.get(uid, head.to_dict()["sessionId"]) if head.exists else None

    def start(self, uid, practical_id):
        practical = self.practical(uid, practical_id)
        head = self.learning.owner_ref(uid, "labPreparationHeads", practical.contentVersion)
        session_id = "prep-" + str(uuid4())

        @firestore.transactional
        def apply(transaction):
            saved = head.get(transaction=transaction, timeout=5)
            if saved.exists:
                return self.record(uid, saved.to_dict()["sessionId"], transaction)
            timestamp = now()
            record = PreparationRecord(
                schema="lab-preparation/v1",
                id=session_id,
                ownerLearnerId=uid,
                practicalId=PRACTICAL,
                contentVersion=practical.contentVersion,
                revision=0,
                currentCheckpointId=practical.checkpoints[0].id,
                prediction="",
                projectRef="",
                observationNotes={},
                createdAt=timestamp,
                updatedAt=timestamp,
            )
            transaction.create(self.ref(uid, session_id), dump(record))
            transaction.create(head, {"sessionId": session_id})
            return record

        return self.view(apply(self.client.transaction(max_attempts=3)))

    def update(self, uid, session_id, draft):
        self.learning.access(uid)
        current = self.record(uid, session_id)
        root = self.client.document(f"learningCatalog/{PLAN}/versions/{current.contentVersion}")
        practical = self.project(root, current.contentVersion)
        if draft.currentCheckpointId not in {c.id for c in practical.checkpoints}:
            raise BoundaryError(422, "This checkpoint does not belong to the experiment.")
        changes = dump(draft)
        del changes["expectedRevision"]

        @firestore.transactional
        def apply(transaction):
            record = self.record(uid, session_id, transaction)
            if all(dump(record)[k] == v for k, v in changes.items()):
                return record
            if record.revision != draft.expectedRevision:
                raise BoundaryError(
                    409, "This preparation changed on another device. Reload saved notes."
                )
            saved = PreparationRecord.model_validate(
                {**dump(record), **changes, "revision": record.revision + 1, "updatedAt": now()}
            )
            transaction.set(self.ref(uid, session_id), dump(saved))
            return saved

        return self.view(apply(self.client.transaction(max_attempts=3)))


def register_lab_preparation_routes(app, identity, backend, call):
    user_dep = Annotated[Identity, Depends(identity)]

    def service():
        service = backend().lab_preparations
        if service is None:
            raise BoundaryError(503, "Lab preparation is unavailable.")
        return service

    @app.get("/practicals/{practical_id}", response_model=PracticalEnvelope)
    def practical(practical_id: str, user: user_dep):
        return {"practical": call(lambda: service().practical(user.uid, practical_id))}

    @app.post("/lab-preparations", response_model=PreparationEnvelope)
    def start(body: StartPreparation, user: user_dep):
        return {"preparation": call(lambda: service().start(user.uid, body.practicalId))}

    @app.get("/lab-preparations/active", response_model=ActiveEnvelope)
    def active(user: user_dep, practicalId: str = Query(min_length=1, max_length=128)):
        return {"preparation": call(lambda: service().active(user.uid, practicalId))}

    @app.get("/lab-preparations/{session_id}", response_model=PreparationEnvelope)
    def get(session_id: str, user: user_dep):
        return {"preparation": call(lambda: service().get(user.uid, session_id))}

    @app.patch("/lab-preparations/{session_id}", response_model=PreparationEnvelope)
    def update(session_id: str, body: PreparationDraft, user: user_dep):
        return {"preparation": call(lambda: service().update(user.uid, session_id, body))}
