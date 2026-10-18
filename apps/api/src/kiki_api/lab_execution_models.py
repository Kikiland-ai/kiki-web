"""Allowlisted requests retain kiki-backend's authoritative field names."""

from typing import Literal

from pydantic import Field

from .models import WireModel


class CreateExecution(WireModel):
    pass


class Revision(WireModel):
    revision: int = Field(ge=1)


class AttachExecution(Revision):
    capture_session_id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")


class CheckExecution(Revision):
    frame_id: str = Field(min_length=1, max_length=128)
    view_revision: int = Field(ge=1, le=9_007_199_254_740_991)


class ContextExecution(Revision):
    action: Literal["pause", "resume", "view_changed", "parameters_changed", "condition", "revisit"]
    view_revision: int | None = Field(default=None, ge=1, le=9_007_199_254_740_991)
    condition: Literal["baseline", "phase_fault", "restored_baseline"] | None = None
    checkpoint_id: str | None = Field(default=None, pattern=r"^CP-DSB-(0[1-9]|1[0-2])$")


class ReviewExecution(Revision):
    criterion_ids: list[str] = Field(min_length=1, max_length=12)
    review_note: str = Field(min_length=8, max_length=1000)


class ResponseExecution(Revision):
    kind: Literal["prediction", "observation", "explanation", "question", "note"]
    text: str = Field(min_length=1, max_length=2000)
    self_confidence: int | None = Field(default=None, ge=1, le=5)


class StreamTicketRequest(WireModel):
    screenSessionId: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")


class StreamTicket(WireModel):
    ticket: str
    expiresInSeconds: Literal[60] = 60


class ExecutionEnvelope(WireModel):
    schema_: Literal["lab-execution/v1"] = Field(default="lab-execution/v1", alias="schema")
    preparationId: str
    backendLabId: str
    state: dict


class ExecutionLink(WireModel):
    schema_: Literal["lab-execution-link/v1"] = Field(
        default="lab-execution-link/v1", alias="schema"
    )
    backendLabId: str | None = None
    backend: Literal["kiki-backend-python"] = "kiki-backend-python"
    practicalId: Literal["PR-AM-DSB"] = "PR-AM-DSB"
    contentVersion: str
    createdAt: str
    operationKey: str
    status: Literal["creating", "linked"] = "creating"
    screenSessions: list[str] = Field(default_factory=list, max_length=20)
    monitoring: Literal["connecting", "active", "paused", "disconnected", "completed"] = (
        "connecting"
    )
    monitoringAt: float = 0.0
