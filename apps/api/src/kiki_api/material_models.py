"""Public intake-view/v1 projection; internal object paths never cross this boundary."""

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_BODY_BYTES = 5 * MAX_FILE_BYTES + 65536
Mime = Literal["application/pdf", "image/jpeg", "image/png"]
Identifier = Annotated[str, Field(pattern=r"^[a-f0-9]{64}(?:-[0-4])?$")]


class IntakeContext(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    courseId: Literal["CRS-AC-ECE"]
    kind: Literal["syllabus", "notes", "experiment_sheet"]
    topic: Annotated[str, Field(min_length=1, max_length=180)]
    note: Annotated[str, Field(max_length=1000)] = ""
    classDate: str = ""

    @field_validator("topic")
    @classmethod
    def nonempty_topic(cls, value):
        if not value.strip():
            raise ValueError("Enter a topic")
        return value.strip()

    @field_validator("classDate")
    @classmethod
    def calendar_date(cls, value):
        if value and (
            not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) or not date.fromisoformat(value)
        ):
            raise ValueError("Use a calendar date")
        return value


class SourceAsset(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: Identifier
    requestId: Identifier
    ownerLearnerId: str
    title: Annotated[str, Field(min_length=1, max_length=240)]
    mime: Mime
    size: Annotated[int, Field(gt=0, le=MAX_FILE_BYTES)]
    sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    createdAt: str


class StoredRequest(IntakeContext):
    # This slice only creates stored receipts. Worker stages are separate future models.
    schema_: Literal["intake-view/v1"] = Field(default="intake-view/v1", alias="schema")
    id: Identifier
    ownerLearnerId: str
    status: Literal["stored"] = "stored"
    sources: Annotated[list[SourceAsset], Field(min_length=1, max_length=5)]
    outline: None = None
    jobId: str
    lessonPlanId: None = None
    failure: None = None
    createdAt: str
    updatedAt: str


class RequestEnvelope(BaseModel):
    request: StoredRequest


class RequestsEnvelope(BaseModel):
    requests: list[StoredRequest]
    nextCursor: str | None = None


class SourceEnvelope(BaseModel):
    source: SourceAsset
