"""Fixed lab execution routes, incremental SSE and ticketed, revocation-checked WS relay."""

import asyncio
import json
from typing import Annotated

import anyio
from fastapi import Depends, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response, StreamingResponse
from websockets.exceptions import WebSocketException

from .backend import BoundaryError
from .lab_execution_models import (
    AttachExecution,
    CheckExecution,
    ContextExecution,
    CreateExecution,
    ExecutionEnvelope,
    ResponseExecution,
    ReviewExecution,
    StreamTicket,
    StreamTicketRequest,
)
from .lab_tickets import StreamTickets
from .lab_upstream import UNAVAILABLE
from .models import Identity

ROOT = "/lab-preparations/{prep_id}/execution"
AUTH_RECHECK_SECONDS = 5


class ExecutionBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] != "http" or not (
            path.startswith("/lab-preparations/") and "/execution" in path
        ):
            return await self.app(scope, receive, send)
        chunks = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            total += len(message.get("body", b""))
            if total > 12_000:
                return await JSONResponse({"detail": "Lab request is too large."}, status_code=413)(
                    scope, receive, send
                )
            chunks.append(message)
            if not message.get("more_body", False):
                break

        async def replay():
            return chunks.pop(0) if chunks else await receive()

        await self.app(scope, replay, send)


def register_lab_execution_routes(app, identity, backend, call, settings):
    user_dep = Annotated[Identity, Depends(identity)]
    tickets = (
        StreamTickets(settings.lab_proxy_secret.get_secret_value())
        if settings.lab_proxy_secret
        else None
    )
    app.state.lab_stream_tickets = tickets

    def service(uid, prep_id):
        services = backend()
        if services.lab_preparations is None:
            raise BoundaryError(503, UNAVAILABLE)
        # Check ownership even when execution is disabled.
        services.lab_preparations.learning.access(uid)
        services.lab_preparations.record(uid, prep_id)
        if settings.lab_execution_mode == "disabled" or services.lab_executions is None:
            raise BoundaryError(503, UNAVAILABLE)
        return services.lab_executions

    async def owned(uid, prep_id):
        return await anyio.to_thread.run_sync(lambda: call(lambda: service(uid, prep_id)))

    @app.post(ROOT, response_model=ExecutionEnvelope)
    async def create(prep_id: str, _body: CreateExecution, user: user_dep):
        return await (await owned(user.uid, prep_id)).start(user.uid, prep_id)

    @app.get(ROOT, response_model=ExecutionEnvelope)
    async def read(prep_id: str, user: user_dep):
        return await (await owned(user.uid, prep_id)).read(user.uid, prep_id)

    @app.post(ROOT + "/screen-sessions")
    async def screen(prep_id: str, _body: CreateExecution, user: user_dep):
        return await (await owned(user.uid, prep_id)).screen(user.uid, prep_id)

    @app.post(ROOT + "/stream-ticket", response_model=StreamTicket)
    async def ticket(prep_id: str, body: StreamTicketRequest, user: user_dep, request: Request):
        execution = await owned(user.uid, prep_id)
        link = await anyio.to_thread.run_sync(execution.link, user.uid, prep_id)
        execution.owns_screen(link, body.screenSessionId)
        token = request.headers["authorization"].split(None, 1)[1]
        return StreamTicket(ticket=tickets.issue(user.uid, prep_id, body.screenSessionId, token))

    @app.post(ROOT + "/attach", response_model=ExecutionEnvelope)
    async def attach(prep_id: str, body: AttachExecution, user: user_dep):
        return await (await owned(user.uid, prep_id)).mutate(user.uid, prep_id, "attach", body)

    @app.post(ROOT + "/context", response_model=ExecutionEnvelope)
    async def context(prep_id: str, body: ContextExecution, user: user_dep):
        return await (await owned(user.uid, prep_id)).mutate(user.uid, prep_id, "context", body)

    @app.post(ROOT + "/review", response_model=ExecutionEnvelope)
    async def review(prep_id: str, body: ReviewExecution, user: user_dep):
        return await (await owned(user.uid, prep_id)).mutate(user.uid, prep_id, "review", body)

    @app.post(ROOT + "/responses", response_model=ExecutionEnvelope)
    async def respond(prep_id: str, body: ResponseExecution, user: user_dep):
        return await (await owned(user.uid, prep_id)).mutate(user.uid, prep_id, "responses", body)

    @app.post(
        ROOT + "/check-stream",
        response_class=StreamingResponse,
        responses={
            200: {
                "description": "Incremental lab-analysis-stream/v2 events",
                "content": {"text/event-stream": {"schema": {"type": "string"}}},
            }
        },
    )
    async def check(prep_id: str, body: CheckExecution, user: user_dep):
        execution = await owned(user.uid, prep_id)
        link = await anyio.to_thread.run_sync(execution.link, user.uid, prep_id)
        # Enter before returning headers so connection/status failures map to HTTP503.
        manager = execution.upstream.stream(
            f"/lab-sessions/{link.backendLabId}/check-stream", user.uid, body.model_dump()
        )
        chunks = await manager.__aenter__()

        async def deliver():
            total = 0
            try:
                async for chunk in chunks:
                    total += len(chunk)
                    if total > 4_000_000:
                        break  # client rejects a truncated stream; no partial state is adopted
                    yield chunk
            finally:
                await manager.__aexit__(None, None, None)

        return StreamingResponse(
            deliver(),
            media_type="text/event-stream",
            headers={"Cache-Control": "private, no-store", "X-Accel-Buffering": "no"},
        )

    @app.get(ROOT + "/events")
    async def events(
        prep_id: str,
        user: user_dep,
        after: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=1, le=100),
    ):
        execution = await owned(user.uid, prep_id)
        link = await anyio.to_thread.run_sync(execution.link, user.uid, prep_id)
        data = await execution.call(
            "GET", f"/lab-sessions/{link.backendLabId}/events?after={after}&limit={limit}", user.uid
        )
        return JSONResponse(data, headers={"Cache-Control": "private, no-store"})

    @app.get(ROOT + "/image")
    async def image(prep_id: str, user: user_dep):
        execution = await owned(user.uid, prep_id)
        link = await anyio.to_thread.run_sync(execution.link, user.uid, prep_id)
        data, mime = await execution.upstream.request(
            "GET", f"/lab-sessions/{link.backendLabId}/image", user.uid
        )
        if not mime.startswith("image/jpeg"):
            raise BoundaryError(503, UNAVAILABLE)
        return Response(
            data,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
        )

    @app.websocket(ROOT + "/screen-sessions/{sid}/stream")
    async def stream(ws: WebSocket, prep_id: str, sid: str):
        ticket_value = ws.query_params.get("ticket", "")
        # Uvicorn uses this scope for its accept/close log: never log capabilities.
        ws.scope["query_string"] = b""
        if ws.headers.get("origin") not in settings.cors_origins or tickets is None:
            await ws.close(code=1008)
            return
        tasks = []
        execution = None
        uid = None
        try:
            lease = tickets.consume(ticket_value, prep_id, sid)
            user = await anyio.to_thread.run_sync(
                lambda: call(lambda: backend().verifier.verify(lease["token"]))
            )
            if user.uid != lease["uid"]:
                raise BoundaryError(401, "Sign in again.")
            uid = user.uid
            execution = await owned(uid, prep_id)
            link = await anyio.to_thread.run_sync(execution.link, uid, prep_id)
            execution.owns_screen(link, sid)
            async with execution.upstream.socket(sid, uid) as upstream:
                await ws.accept()

                async def browser_to_backend():
                    while True:
                        message = await ws.receive()
                        if message["type"] == "websocket.disconnect":
                            return
                        if message.get("bytes") is not None:
                            payload = message["bytes"]
                            if len(payload) > 1_000_000:
                                raise BoundaryError(413, "Frame too large.")
                        else:
                            payload = message.get("text", "")
                            if len(payload.encode()) > 4096:
                                raise BoundaryError(413, "Frame metadata too large.")
                            data = json.loads(payload)
                            if not isinstance(data, dict) or data.get("type") not in {
                                "frame",
                                "capture_started",
                                "pause",
                                "resume",
                                "stop",
                                "heartbeat",
                            }:
                                raise BoundaryError(422, "Invalid frame message.")
                        await upstream.send(payload)

                async def backend_to_browser():
                    async for payload in upstream:
                        if isinstance(payload, bytes):
                            await ws.send_bytes(payload)
                        else:
                            await ws.send_text(payload)

                async def watch_identity():
                    while True:
                        await asyncio.sleep(AUTH_RECHECK_SECONDS)
                        await anyio.to_thread.run_sync(
                            lambda: call(lambda: backend().verifier.verify(lease["token"]))
                        )
                        await anyio.to_thread.run_sync(execution.access, uid, prep_id)

                tasks = [
                    asyncio.create_task(fn())
                    for fn in (browser_to_backend, backend_to_browser, watch_identity)
                ]
                done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task.result()
        except (
            asyncio.CancelledError,
            BoundaryError,
            ValueError,
            WebSocketDisconnect,
            WebSocketException,
            OSError,
            TimeoutError,
        ):
            pass  # no tokens, pixels, model prose or foreign IDs enter logs/errors
        finally:
            with anyio.CancelScope(shield=True):
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                try:
                    await ws.close(code=1008)
                except (RuntimeError, WebSocketDisconnect):
                    pass
                if execution and uid:
                    await anyio.to_thread.run_sync(
                        lambda: call(lambda: execution.disconnected(uid, prep_id))
                    )
