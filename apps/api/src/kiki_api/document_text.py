"""Authenticated text-only Library records. No binary storage or extraction worker."""

import hashlib
import json
import re
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import Depends, Header, Query
from firebase_admin import firestore
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .backend import BoundaryError
from .material_models import IntakeContext, RequestEnvelope, SourceAsset, StoredRequest, TextSummary
from .models import Identity

MAX_TEXT_BYTES = 1024 * 1024
MAX_TEXT_BODY_BYTES = 12 * 1024 * 1024
CHUNK_BYTES = 32768


class TextUnit(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    number: Annotated[int, Field(ge=1, le=500)]
    text: Annotated[str, Field(min_length=1, max_length=MAX_TEXT_BYTES)]


class TextDocument(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    title: Annotated[str, Field(min_length=1, max_length=240)]
    mime: Literal[
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
    ]
    size: Annotated[int, Field(ge=1, le=10 * 1024 * 1024)]
    method: Literal["pdf-text", "pptx-text", "pasted"]
    unitLabel: Literal["page", "slide", "section"]
    unitCount: Annotated[int, Field(ge=1, le=500)]
    units: Annotated[list[TextUnit], Field(min_length=1, max_length=500)]
    warnings: Annotated[list[Annotated[str, Field(max_length=240)]], Field(max_length=5)]

    @model_validator(mode="after")
    def bounded_document(self):
        expected = {
            "application/pdf": ("pdf-text", "page"),
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
                "pptx-text",
                "slide",
            ),
            "text/plain": ("pasted", "section"),
        }
        if (self.method, self.unitLabel) != expected[self.mime]:
            raise ValueError("Source type/method mismatch")
        previous, total = 0, 0
        if not self.title.strip() or re.search(r"[\x00-\x1f\x7f]", self.title):
            raise ValueError("Invalid title")
        for unit in self.units:
            if not previous < unit.number <= self.unitCount or not unit.text.strip():
                raise ValueError("Text must be non-empty and in source order")
            if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", unit.text):
                raise ValueError("Invalid control characters")
            previous = unit.number
            total += len(unit.text.encode("utf-8"))
        if total > MAX_TEXT_BYTES:
            raise ValueError("Keep text below 1 MiB per document")
        return self


class TextIntake(IntakeContext):
    documents: Annotated[list[TextDocument], Field(min_length=1, max_length=5)]


class TextChunk(BaseModel):
    index: int
    text: str


class SourceTextEnvelope(BaseModel):
    source: SourceAsset
    chunks: list[TextChunk]
    nextCursor: int | None


def split_text(text):
    # Never cut a Unicode code point; Odia/English are kept verbatim.
    chunks, current, size = [], [], 0
    for char in text:
        width = len(char.encode("utf-8"))
        if size + width > CHUNK_BYTES:
            chunks.append("".join(current))
            current, size = [], 0
        current.append(char)
        size += width
    if current:
        chunks.append("".join(current))
    return chunks


def save_text(records, uid, body: TextIntake, key):
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,200}", key):
        raise BoundaryError(422, "Provide a valid save operation key.")
    request_id = hashlib.sha256(json.dumps([uid, "document-text", key]).encode()).hexdigest()
    fingerprint = hashlib.sha256(
        json.dumps(body.model_dump(), sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    sources, texts = [], []
    for i, document in enumerate(body.documents):
        text = "\n\n".join(
            f"{document.unitLabel.capitalize()} {unit.number}\n{unit.text}"
            for unit in document.units
        )
        chunks = split_text(text)
        texts.append(chunks)
        sources.append(
            SourceAsset(
                id=f"{request_id}-{i}",
                requestId=request_id,
                ownerLearnerId=uid,
                title=document.title.strip(),
                mime=document.mime,
                size=document.size,
                originalAvailable=False,
                createdAt=now,
                textSummary=TextSummary(
                    method=document.method,
                    unitLabel=document.unitLabel,
                    unitCount=document.unitCount,
                    chunkCount=len(chunks),
                    byteCount=len(text.encode()),
                    warnings=document.warnings,
                ),
            )
        )
    receipt = StoredRequest(
        **body.model_dump(exclude={"documents"}),
        id=request_id,
        ownerLearnerId=uid,
        status="text_saved",
        sources=sources,
        jobId=None,
        createdAt=now,
        updatedAt=now,
    )
    ref = records.collection(uid, "studyRequests").document(request_id)
    operation = records.collection(uid, "textSaveOperations").document(request_id)

    @firestore.transactional
    def apply(transaction):
        saved = ref.get(transaction=transaction, timeout=5)
        ticket = operation.get(transaction=transaction, timeout=5)
        if saved.exists:
            if not ticket.exists or ticket.to_dict().get("fingerprint") != fingerprint:
                raise BoundaryError(409, "This save key was used with different text or details.")
            # Use the same canonical projection and ownership checks as the Library list.
            from .materials import public_request

            return public_request(saved.to_dict(), uid)
        if ticket.exists:
            raise BoundaryError(503, "This text record needs a compatibility check.")
        transaction.create(operation, {"fingerprint": fingerprint, "createdAt": now})
        transaction.create(ref, receipt.model_dump(by_alias=True))
        for source, chunks in zip(sources, texts, strict=True):
            source_ref = records.collection(uid, "sourceDocs").document(source.id)
            transaction.create(source_ref, source.model_dump())
            for index, text in enumerate(chunks):
                transaction.create(
                    source_ref.collection("textChunks").document(f"{index:04}"),
                    {
                        "index": index,
                        "text": text,
                        "sha256": hashlib.sha256(text.encode()).hexdigest(),
                    },
                )
        return receipt

    return apply(records.client.transaction(max_attempts=3))


def read_text(records, uid, source_id, cursor):
    source, _ = records.source(uid, source_id)
    summary = source.textSummary
    if not summary:
        raise BoundaryError(409, "No extracted text is saved for this original.")
    if cursor >= summary.chunkCount:
        raise BoundaryError(422, "Open the saved text again from Library.")
    end = min(cursor + 5, summary.chunkCount)
    chunks = []
    ref = records.collection(uid, "sourceDocs").document(source.id)
    for index in range(cursor, end):
        snapshot = ref.collection("textChunks").document(f"{index:04}").get(timeout=5)
        if not snapshot.exists:
            raise BoundaryError(503, "The saved text is incomplete. Please retry shortly.")
        chunk = snapshot.to_dict()
        text = chunk.get("text")
        if (
            not isinstance(text, str)
            or chunk.get("index") != index
            or len(text.encode()) > CHUNK_BYTES
            or hashlib.sha256(text.encode()).hexdigest() != chunk.get("sha256")
        ):
            raise BoundaryError(503, "The saved text does not match its record.")
        chunks.append(TextChunk(index=index, text=text))
    return SourceTextEnvelope(
        source=source, chunks=chunks, nextCursor=end if end < summary.chunkCount else None
    )


def register_text_routes(application, identity, backend, call):
    def records():
        library = backend().materials
        if not library:
            raise BoundaryError(503, "The Library service is not configured yet.")
        return library.records

    @application.post("/study-requests/text", response_model=RequestEnvelope)
    def create_text(
        body: TextIntake,
        user: Annotated[Identity, Depends(identity)],
        key: Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=200)],
    ):
        def save():
            profile = backend().profiles.get(user.uid)
            if body.courseId not in profile.courseIds:
                raise BoundaryError(409, "Add this subject before saving its material.")
            return save_text(records(), user.uid, body, key)

        return RequestEnvelope(request=call(save))

    @application.get("/source-docs/{source_id}/text", response_model=SourceTextEnvelope)
    def source_text(
        source_id: str,
        user: Annotated[Identity, Depends(identity)],
        cursor: Annotated[int, Query(ge=0)] = 0,
    ):
        return call(lambda: read_text(records(), user.uid, source_id, cursor))
