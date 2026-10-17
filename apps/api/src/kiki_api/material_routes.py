from typing import Annotated
from urllib.parse import quote

from fastapi import Depends, Header, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException

from .backend import BoundaryError
from .document_text import MAX_TEXT_BODY_BYTES
from .material_files import inspect_file
from .material_models import (
    MAX_BODY_BYTES,
    IntakeContext,
    RequestEnvelope,
    RequestsEnvelope,
    SourceEnvelope,
)
from .models import Identity


class UploadBodyLimit:
    """Bound actual bytes even when Content-Length is absent or forged."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope["path"] not in {"/study-requests", "/study-requests/text"}
            or scope["method"] != "POST"
        ):
            return await self.app(scope, receive, send)
        limit = MAX_TEXT_BODY_BYTES if scope["path"].endswith("/text") else MAX_BODY_BYTES
        message = (
            "Save a smaller batch of document text."
            if scope["path"].endswith("/text")
            else "Choose up to five files, no larger than 10 MB each."
        )
        total = 0

        async def limited_receive():
            nonlocal total
            event = await receive()
            if event["type"] == "http.request":
                total += len(event.get("body", b""))
                if total > limit:
                    raise BoundaryError(413, message)
            return event

        try:
            length = dict(scope["headers"]).get(b"content-length")
            if length and (not length.isdigit() or int(length) > limit):
                raise BoundaryError(413, message)
            await self.app(scope, limited_receive, send)
        except BoundaryError as exc:
            await JSONResponse({"detail": exc.message}, status_code=exc.status)(
                scope, receive, send
            )


def register_material_routes(application, identity, backend, call):
    def library():
        service = backend().materials
        if not service:
            raise BoundaryError(503, "The Library service is not configured yet.")
        return service

    @application.post(
        "/study-requests",
        response_model=RequestEnvelope,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "multipart/form-data": {
                        "schema": {
                            "type": "object",
                            "required": ["context", "files"],
                            "properties": {
                                "context": {
                                    "type": "string",
                                    "description": (
                                        "JSON IntakeContext: courseId, kind, topic, note, classDate"
                                    ),
                                },
                                "files": {
                                    "type": "array",
                                    "minItems": 1,
                                    "maxItems": 5,
                                    "items": {"type": "string", "format": "binary"},
                                },
                            },
                        },
                    }
                },
            }
        },
    )
    async def create_material(
        request: Request,
        user: Annotated[Identity, Depends(identity)],
        operation_key: Annotated[
            str, Header(alias="Idempotency-Key", min_length=8, max_length=200)
        ],
    ):
        if not request.headers.get("content-type", "").startswith("multipart/form-data;"):
            raise BoundaryError(415, "Upload files using multipart form data.")
        try:
            async with request.form(max_files=5, max_fields=1, max_part_size=8192) as form:
                files = form.getlist("files")
                if (
                    set(form.keys()) != {"context", "files"}
                    or len(form.getlist("context")) != 1
                    or not isinstance(form["context"], str)
                    or not 1 <= len(files) <= 5
                    or not all(isinstance(file, UploadFile) for file in files)
                ):
                    raise BoundaryError(422, "Provide one context and one to five original files.")
                try:
                    context = IntakeContext.model_validate_json(form["context"])
                except ValidationError:
                    raise BoundaryError(
                        422, "Check the subject, topic, date and material details."
                    ) from None

                def save():
                    profile = backend().profiles.get(user.uid)
                    if context.courseId not in profile.courseIds:
                        raise BoundaryError(409, "Add this subject before uploading its material.")
                    originals = [inspect_file(file) for file in files]
                    return library().create(user.uid, context, originals, operation_key)

                receipt = await run_in_threadpool(lambda: call(save))
                return RequestEnvelope(request=receipt)
        except HTTPException:
            raise BoundaryError(
                422, "Check the upload format and choose one to five files."
            ) from None

    @application.get("/study-requests", response_model=RequestsEnvelope)
    def list_material(
        user: Annotated[Identity, Depends(identity)],
        cursor: str | None = None,
        page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    ):
        return call(lambda: library().records.list(user.uid, cursor, page_size))

    @application.get("/study-requests/{request_id}", response_model=RequestEnvelope)
    def get_material(request_id: str, user: Annotated[Identity, Depends(identity)]):
        return RequestEnvelope(request=call(lambda: library().records.get(user.uid, request_id)))

    @application.get("/source-docs/{source_id}", response_model=SourceEnvelope)
    def get_source(source_id: str, user: Annotated[Identity, Depends(identity)]):
        return SourceEnvelope(source=call(lambda: library().records.source(user.uid, source_id)[0]))

    @application.get("/source-docs/{source_id}/content", response_class=Response)
    def get_original(source_id: str, user: Annotated[Identity, Depends(identity)]):
        source, content = call(lambda: library().content(user.uid, source_id))
        return Response(
            content,
            media_type=source.mime,
            headers={
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "sandbox; default-src 'none'",
                "Content-Disposition": "attachment; filename*=UTF-8''"
                + quote(source.title, safe=""),
            },
        )

    # Keep these transitions closed until a real extraction/generation worker is supplied.
    @application.post("/study-requests/{request_id}/confirm", response_model=RequestEnvelope)
    @application.post("/study-requests/{request_id}/retry", response_model=RequestEnvelope)
    def processing_unavailable(request_id: str, user: Annotated[Identity, Depends(identity)]):
        record = call(lambda: library().records.get(user.uid, request_id))
        if record.status == "text_saved":
            raise BoundaryError(409, "Your text is saved. Lesson preparation is not available yet.")
        raise BoundaryError(
            409, "Your originals are saved. Reading and lesson preparation are not available yet."
        )
