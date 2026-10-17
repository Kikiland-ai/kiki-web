"""Public intake-view/v1 projection; internal object paths never cross this boundary."""

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_BODY_BYTES = 5 * MAX_FILE_BYTES + 65536
Mime = Literal[
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
]
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


class TextSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    method: Literal["pdf-text", "pptx-text", "pasted"]
    unitLabel: Literal["page", "slide", "section"]
    unitCount: Annotated[int, Field(ge=1, le=500)]
    chunkCount: Annotated[int, Field(ge=1, le=200)]
    byteCount: Annotated[int, Field(ge=1, le=1024 * 1024 + 30000)]
    warnings: Annotated[list[Annotated[str, Field(max_length=240)]], Field(max_length=5)]


class SourceAsset(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: Identifier
    requestId: Identifier
    ownerLearnerId: str
    title: Annotated[str, Field(min_length=1, max_length=240)]
    mime: Mime
    size: Annotated[int, Field(gt=0, le=MAX_FILE_BYTES)]
    sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")] | None = None
    originalAvailable: bool = True
    textSummary: TextSummary | None = None
    createdAt: str

    @model_validator(mode="after")
    def availability(self):
        if self.originalAvailable and not self.sha256:
            raise ValueError("Stored originals require their checksum")
        if not self.originalAvailable and not self.textSummary:
            raise ValueError("Text-only sources require a text summary")
        return self


class StoredRequest(IntakeContext):
    # Original receipts and explicit text-only receipts share the existing Library list.
    schema_: Literal["intake-view/v1"] = Field(default="intake-view/v1", alias="schema")
    id: Identifier
    ownerLearnerId: str
    status: Literal["stored", "text_saved"] = "stored"
    sources: Annotated[list[SourceAsset], Field(min_length=1, max_length=5)]
    outline: None = None
    jobId: str | None
    lessonPlanId: None = None
    failure: None = None
    createdAt: str
    updatedAt: str

    @model_validator(mode="after")
    def source_mode(self):
        if self.status == "text_saved":
            if self.jobId is not None or any(s.originalAvailable for s in self.sources):
                raise ValueError("Text-only records have no originals or processing job")
        elif self.jobId is None or any(not s.originalAvailable for s in self.sources):
            raise ValueError("Stored receipts require original files and a job record")
        return self


class RequestEnvelope(BaseModel):
    request: StoredRequest


class RequestsEnvelope(BaseModel):
    requests: list[StoredRequest]
    nextCursor: str | None = None


class SourceEnvelope(BaseModel):
    source: SourceAsset
