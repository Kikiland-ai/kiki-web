"""Web auth relay and narration for the owned physical lab session."""

import json
from typing import Annotated

import anyio
from fastapi import Depends, Header, Path, Request
from fastapi.responses import JSONResponse, Response

from .backend import BoundaryError
from .lab_narration import (
    MIME,
    PRIVATE_HEADERS,
    SHA256,
    PhysicalLabNarrationIndex,
    wav_response,
)
from .lab_upstream import MAX_JSON_BYTES, LabUpstream
from .models import Identity


class PhysicalLabBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/physical-labs"):
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > 16000:
                return await JSONResponse({"detail": "Lab request is too large."}, 413)(
                    scope, receive, send
                )
            chunks.append(message)
            if not message.get("more_body", False):
                break

        async def replay():
            return chunks.pop(0) if chunks else await receive()

        return await self.app(scope, replay, send)


def register_physical_lab_routes(app, identity, backend, call, settings):
    user_dep = Annotated[Identity, Depends(identity)]
    session_id_type = Annotated[str, Path(pattern=r"^[a-f0-9]{32}$")]

    async def authorized_services(uid):
        def access():
            services = backend()
            if services.learning is None:
                raise BoundaryError(503, "Physical lab practice is unavailable.")
            services.learning.access(uid)
            if not settings.physical_labs_enabled:
                raise BoundaryError(503, "Physical lab practice is not enabled yet.")
            return services

        return await anyio.to_thread.run_sync(lambda: call(access))

    async def relay(user, method, path, request=None, key=None):
        await authorized_services(user.uid)
        body = None
        if method == "POST":
            if request.headers.get("origin") not in settings.cors_origins:
                raise BoundaryError(403, "Open physical lab practice from Kiki.")
            try:
                body = await request.json()
            except ValueError:
                raise BoundaryError(422, "Expected a lab action.") from None
            if not isinstance(body, dict):
                raise BoundaryError(422, "Expected a lab action.")
        # Fixed origin and server-derived owner; no incoming secrets/cookies/auth forwarded.
        upstream = LabUpstream(settings)
        async with upstream.response(
            method, "/v1/physical-labs" + path, user.uid, body, key
        ) as response:
            content = bytearray()
            async for chunk in response.aiter_bytes():
                content.extend(chunk)
                if len(content) > MAX_JSON_BYTES:
                    raise BoundaryError(503, "The physical lab response is too large.")
            return Response(
                bytes(content),
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json"),
                headers={"Cache-Control": "private, no-store"},
            )

    @app.get("/physical-labs/experiments")
    async def catalogue(user: user_dep):
        return await relay(user, "GET", "/experiments")

    @app.get("/physical-labs/experiments/{experiment_id}")
    async def experiment(
        experiment_id: Annotated[str, Path(pattern=r"^[a-zA-Z0-9_-]{1,100}$")], user: user_dep
    ):
        return await relay(user, "GET", f"/experiments/{experiment_id}")

    @app.get("/physical-labs/assets/{name}")
    async def asset(name: Annotated[str, Path(pattern=r"^[a-zA-Z0-9_-]+\.gltf$")], user: user_dep):
        return await relay(user, "GET", f"/assets/{name}")

    @app.get("/physical-labs/sessions")
    async def sessions(user: user_dep):
        return await relay(user, "GET", "/sessions")

    @app.post("/physical-labs/sessions", status_code=201)
    async def create(
        request: Request,
        user: user_dep,
        idempotency_key: Annotated[
            str, Header(alias="Idempotency-Key", pattern=r"^[A-Za-z0-9_.:-]{1,100}$")
        ],
    ):
        return await relay(user, "POST", "/sessions", request, idempotency_key)

    @app.get("/physical-labs/sessions/{session_id}")
    async def session(session_id: session_id_type, user: user_dep):
        return await relay(user, "GET", f"/sessions/{session_id}")

    async def authorized_narration(session_id, uid):
        services = await authorized_services(uid)
        narration = services.physical_lab_narration
        if narration is None:
            raise BoundaryError(404, "Narration is unavailable for this lab.")
        body, _ = await LabUpstream(settings).request(
            "GET", f"/v1/physical-labs/sessions/{session_id}", uid
        )
        try:
            state = json.loads(body)
        except (ValueError, UnicodeError):
            raise BoundaryError(503, "The physical lab response could not be read.") from None
        if not isinstance(state, dict) or state.get("session_id") != session_id:
            raise BoundaryError(503, "The physical lab response could not be read.")
        index = narration.index
        if (
            state.get("experiment_id"),
            state.get("pack_version"),
            state.get("pack_sha256"),
            state.get("mode"),
        ) != (index["experimentId"], index["packVersion"], index["packSha256"], index["mode"]):
            raise BoundaryError(404, "Narration is unavailable for this lab.")
        return narration

    narration_root = "/physical-labs/sessions/{session_id}/narration"

    @app.get(narration_root, response_model=PhysicalLabNarrationIndex)
    async def narration_manifest(session_id: session_id_type, user: user_dep, response: Response):
        narration = await authorized_narration(session_id, user.uid)
        response.headers.update(PRIVATE_HEADERS)
        return narration.index

    @app.get(
        narration_root + "/{revision}/assets/{asset_id}",
        response_class=Response,
        responses={200: {"content": {MIME: {}}, "description": "Verified physical lab WAV"}},
    )
    async def narration_audio(
        session_id: session_id_type,
        revision: Annotated[str, Path(pattern=SHA256)],
        asset_id: Annotated[str, Path(pattern=SHA256)],
        user: user_dep,
    ):
        narration = await authorized_narration(session_id, user.uid)
        content = await anyio.to_thread.run_sync(
            lambda: call(lambda: narration.read(revision, asset_id))
        )
        return wav_response(content, asset_id)

    @app.get("/physical-labs/sessions/{session_id}/pack")
    async def pack(session_id: session_id_type, user: user_dep):
        return await relay(user, "GET", f"/sessions/{session_id}/pack")

    @app.post("/physical-labs/sessions/{session_id}/events")
    async def event(session_id: session_id_type, request: Request, user: user_dep):
        return await relay(user, "POST", f"/sessions/{session_id}/events", request)

    @app.get("/physical-labs/sessions/{session_id}/observations")
    async def observations(session_id: session_id_type, user: user_dep):
        return await relay(user, "GET", f"/sessions/{session_id}/observations")

    @app.get("/physical-labs/sessions/{session_id}/experiment-result")
    async def result(session_id: session_id_type, user: user_dep):
        return await relay(user, "GET", f"/sessions/{session_id}/experiment-result")

    @app.get("/physical-labs/sessions/{session_id}/receipt")
    async def receipt(session_id: session_id_type, user: user_dep):
        return await relay(user, "GET", f"/sessions/{session_id}/receipt")
