"""Authenticated lab relay over deterministic doubles: no cloud, pixels or provider calls."""

import asyncio
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from copy import deepcopy
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_lab_preparation import catalog, start
from test_learning import Store, transactional
from test_profiles import TestVerifier, bootstrap, headers

from kiki_api.backend import BoundaryError, FirestoreProfiles, Services
from kiki_api.config import Settings
from kiki_api.lab_execution import LabExecutions
from kiki_api.lab_preparation import LabPreparations
from kiki_api.lab_tickets import StreamTickets
from kiki_api.lab_upstream import LabUpstream
from kiki_api.learning import FirestoreLearning
from kiki_api.learning_catalog import import_catalog
from kiki_api.main import create_app

__all__ = ["catalog"]
SECRET = "local-unit-proxy-" + "x" * 32
ORIGIN = "http://127.0.0.1:5174"


class EchoSocket:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.queue.put_nowait(json.dumps({"type": "connected"}))

    async def send(self, payload):
        await self.queue.put(payload)

    def __aiter__(self):
        return self

    async def __anext__(self):
        return await self.queue.get()


class FakeUpstream:
    def __init__(self):
        self.calls = []
        self.states = {}
        self.fail_create = False
        self.stream_gate = None

    async def request(self, method, path, uid, body=None, operation_key=None):
        self.calls.append((method, path, uid, deepcopy(body), operation_key))
        if method == "POST" and path == "/lab-sessions":
            await asyncio.sleep(0.02)
            if self.fail_create:
                raise BoundaryError(503, "Lab tracking is unavailable; your progress is kept.")
            lab_id = str(uuid4())
            value = {
                "lab_session_id": lab_id,
                "experiment_id": "PR-AM-DSB",
                "revision": 1,
                "status": "active",
                "runtime": {"capture_status": "disconnected"},
            }
            self.states[lab_id] = value
        elif path == "/screen-sessions":
            value = {
                "session_id": str(uuid4()),
                "sample_interval_ms": 2000,
                "max_frame_bytes": 1_000_000,
                "session_limit_seconds": 1200,
            }
        elif path.endswith("/events?after=0&limit=100"):
            value = []
        else:
            lab_id = path.split("/")[2]
            value = self.states[lab_id]
            if method == "POST":
                if body["revision"] != value["revision"]:
                    raise BoundaryError(409, "The lab changed.")
                value["revision"] += 1
                if body.get("action") in {"pause", "resume"}:
                    value["status"] = "paused" if body["action"] == "pause" else "active"
        return json.dumps(value).encode(), "application/json"

    @asynccontextmanager
    async def stream(self, path, uid, body):
        async def chunks():
            yield b"data: first\n\n"
            if self.stream_gate:
                await self.stream_gate.wait()
            yield b"data: second\n\n"

        yield chunks()

    @asynccontextmanager
    async def socket(self, sid, uid):
        yield EchoSocket()


class RevocableVerifier(TestVerifier):
    revoked = False

    def verify(self, token):
        if self.revoked:
            raise BoundaryError(401, "Sign in again.")
        return super().verify(token)


@pytest.fixture
def execution(monkeypatch, catalog):
    lock = threading.RLock()

    def serial(function):
        def apply(transaction):
            with lock:
                return transactional(function)(transaction)

        return apply

    for module in ["lab_preparation", "lab_execution", "learning"]:
        monkeypatch.setattr(f"kiki_api.{module}.firestore.transactional", serial)
    store = Store()
    import_catalog(store, catalog)
    profiles = FirestoreProfiles(store)
    learning = FirestoreLearning(store, profiles)
    preparation = LabPreparations(learning)
    upstream = FakeUpstream()
    service = LabExecutions(preparation, upstream)
    preparation.execution_status = service.status
    verifier = RevocableVerifier()
    services = Services(
        verifier, profiles, learning=learning, lab_preparations=preparation, lab_executions=service
    )
    settings = Settings(
        _env_file=None,
        firebase_project_id="unit-test-project",
        lab_execution_mode="local",
        lab_backend_origin="http://127.0.0.1:8100",
        lab_proxy_secret=SECRET,
        cors_origins=[ORIGIN],
    )
    app = create_app(settings, lambda: services)
    client = TestClient(app, raise_server_exceptions=False)
    for uid in ["a", "b"]:
        bootstrap(client, uid)
        assert (
            client.post(
                "/learners/me/enrollments",
                headers=headers(uid),
                json={"courseId": "CRS-AC-ECE", "semester": 5},
            ).status_code
            == 200
        )
    prep = start(client)
    return client, app, services, upstream, store, f"/lab-preparations/{prep['id']}/execution"


def linked(execution):
    client, _, _, _, _, path = execution
    response = client.post(path, headers=headers(), json={})
    assert response.status_code == 200, response.text
    return response.json()


def screen_ticket(execution):
    client, _, _, _, _, path = execution
    linked(execution)
    sid = client.post(path + "/screen-sessions", headers=headers(), json={}).json()["session_id"]
    ticket = client.post(
        path + "/stream-ticket", headers=headers(), json={"screenSessionId": sid}
    ).json()["ticket"]
    return path + f"/screen-sessions/{sid}/stream?ticket={ticket}"


def test_identity_enrollment_and_preparation_ownership(execution):
    client, _, _, upstream, store, path = execution
    assert client.post(path, json={}).status_code == 401
    assert client.post(path, headers=headers("b"), json={}).status_code == 404
    assert client.post(path, headers=headers(), json={"owner": "b"}).status_code == 422
    store.docs["learners/a"]["courseIds"] = []
    assert client.post(path, headers=headers(), json={}).status_code == 403
    assert not upstream.calls


def test_one_transactional_link_under_concurrent_creates(execution):
    client, _, _, upstream, store, path = execution
    with ThreadPoolExecutor(max_workers=5) as pool:
        responses = list(
            pool.map(lambda _: client.post(path, headers=headers(), json={}), range(5))
        )
    assert all(r.status_code in {200, 503} for r in responses)
    value = client.post(path, headers=headers(), json={}).json()
    creates = [c for c in upstream.calls if c[1] == "/lab-sessions"]
    assert len(creates) == 1 and creates[0][4]
    assert creates[0][2] == "a" and creates[0][3]["progression_mode"] == "screen_guided"
    records = [v for k, v in store.docs.items() if "/labExecutions/" in k]
    assert len(records) == 1 and records[0]["backendLabId"] == value["backendLabId"]
    assert not records[0].get("frames") and "token" not in records[0]


def test_ambiguous_create_failure_never_creates_another_upstream_lab(execution):
    client, _, _, upstream, _, path = execution
    upstream.fail_create = True
    assert client.post(path, headers=headers(), json={}).status_code == 503
    upstream.fail_create = False
    assert client.post(path, headers=headers(), json={}).status_code == 503
    assert len(upstream.calls) == 1


def test_mutations_are_revisioned_and_screens_bound_to_the_preparation(execution):
    client, _, _, _, _, path = execution
    value = linked(execution)
    assert (
        client.post(
            path + "/attach",
            headers=headers(),
            json={"revision": 1, "capture_session_id": "foreign"},
        ).status_code
        == 404
    )
    paused = client.post(
        path + "/context",
        headers=headers(),
        json={"revision": value["state"]["revision"], "action": "pause"},
    )
    assert paused.status_code == 200 and paused.json()["state"]["status"] == "paused"
    assert (
        client.post(
            path + "/context", headers=headers(), json={"revision": 1, "action": "resume"}
        ).status_code
        == 409
    )
    prep = client.get(path.rsplit("/execution", 1)[0], headers=headers()).json()["preparation"]
    assert prep["monitoring"] == {
        "status": "paused",
        "pointerActive": False,
        "assessmentStatus": "not_assessed",
    }


def test_request_limits_and_allowlist(execution):
    client, _, _, _, _, path = execution
    linked(execution)
    assert client.post(path + "/reset", headers=headers(), json={}).status_code == 404
    assert (
        client.post(
            path + "/responses",
            headers=headers(),
            json={"revision": 1, "kind": "note", "text": "x" * 12001},
        ).status_code
        == 413
    )
    assert (
        client.post(
            path + "/context", headers=headers(), json={"revision": 1, "action": "enable_guided"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            path + "/stream-ticket", headers=headers(), json={"screenSessionId": "foreign"}
        ).status_code
        == 404
    )


def test_short_lived_signed_tickets_are_bound_and_single_use():
    clock = [100.0]
    tickets = StreamTickets(SECRET, lambda: clock[0])
    value = tickets.issue("a", "prep-a", "screen-a", "private-test-token")
    assert "private-test-token" not in value
    for prep, sid, token in [
        ("prep-b", "screen-a", value),
        ("prep-a", "screen-b", value),
        ("prep-a", "screen-a", value + "x"),
    ]:
        with pytest.raises(BoundaryError):
            tickets.consume(token, prep, sid)
    assert tickets.consume(value, "prep-a", "screen-a")["uid"] == "a"
    with pytest.raises(BoundaryError):
        tickets.consume(value, "prep-a", "screen-a")
    expired = tickets.issue("a", "prep-a", "screen-a", "private-test-token")
    clock[0] += 61
    with pytest.raises(BoundaryError):
        tickets.consume(expired, "prep-a", "screen-a")


def test_websocket_relays_text_and_bytes_and_rejects_reuse(execution):
    client = execution[0]
    url = screen_ticket(execution)
    with client.websocket_connect(url, headers={"Origin": ORIGIN}) as ws:
        assert ws.receive_json()["type"] == "connected"
        ws.send_json({"type": "heartbeat"})
        assert ws.receive_json()["type"] == "heartbeat"
        ws.send_bytes(b"redacted-jpeg-test")
        assert ws.receive_bytes() == b"redacted-jpeg-test"
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url, headers={"Origin": ORIGIN}):
            pass


def test_websocket_checks_origin_and_firebase_revocation(execution, monkeypatch):
    client, _, services, _, _, _ = execution
    url = screen_ticket(execution)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url, headers={"Origin": "https://foreign.example"}):
            pass
    monkeypatch.setattr("kiki_api.lab_execution_routes.AUTH_RECHECK_SECONDS", 0.01)
    with client.websocket_connect(url, headers={"Origin": ORIGIN}) as ws:
        ws.receive_json()
        services.verifier.revoked = True
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_incremental_sse_is_forwarded_before_the_tail_is_available(execution):
    _, app, _, upstream, _, path = execution
    contract = app.openapi()["paths"]["/lab-preparations/{prep_id}/execution/check-stream"]["post"][
        "responses"
    ]["200"]["content"]
    assert "text/event-stream" in contract and "application/json" not in contract
    linked(execution)

    async def run():
        upstream.stream_gate = asyncio.Event()
        first = asyncio.Event()
        bodies = []
        sent = False

        async def receive():
            nonlocal sent
            if not sent:
                sent = True
                return {
                    "type": "http.request",
                    "body": json.dumps(
                        {"revision": 1, "frame_id": "frame", "view_revision": 1}
                    ).encode(),
                }
            await asyncio.Event().wait()

        async def send(message):
            if message["type"] == "http.response.body" and message.get("body"):
                bodies.append(message["body"])
                first.set()

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.4"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": path + "/check-stream",
            "raw_path": (path + "/check-stream").encode(),
            "query_string": b"",
            "root_path": "",
            "server": ("testserver", 80),
            "client": ("test", 1),
            "headers": [
                (b"authorization", b"Bearer test-a"),
                (b"content-type", b"application/json"),
            ],
        }
        task = asyncio.create_task(app(scope, receive, send))
        await asyncio.wait_for(first.wait(), 2)
        assert bodies == [b"data: first\n\n"] and not task.done()
        upstream.stream_gate.set()
        await asyncio.wait_for(task, 2)
        assert bodies == [b"data: first\n\n", b"data: second\n\n"]

    asyncio.run(run())


def test_transport_strips_forged_headers_and_refuses_redirects():
    calls = []

    def transport(request):
        calls.append(request)
        return httpx.Response(302, headers={"Location": "https://foreign.example"})

    settings = Settings(
        _env_file=None,
        firebase_project_id="unit-test-project",
        lab_execution_mode="local",
        lab_backend_origin="http://127.0.0.1:8100",
        lab_proxy_secret=SECRET,
    )
    upstream = LabUpstream(settings, httpx.MockTransport(transport))
    with pytest.raises(BoundaryError) as error:
        asyncio.run(upstream.request("POST", "/lab-sessions", "a", {}))
    assert error.value.status == 503 and len(calls) == 1
    assert calls[0].headers["x-kiki-owner"] == "fb:a"
    assert calls[0].headers["Origin"] == settings.lab_backend_origin
    assert "cookie" not in calls[0].headers and "authorization" not in calls[0].headers


@pytest.mark.parametrize(
    "origin",
    [
        "http://evil.example",
        "http://127.0.0.1:8101",
        "http://127.0.0.1:8100/path",
        "https://user:password@remote.example",
    ],
)
def test_upstream_settings_refuse_unapproved_origins(origin):
    with pytest.raises(ValueError):
        Settings(
            _env_file=None,
            firebase_project_id="unit-test-project",
            lab_execution_mode="local",
            lab_backend_origin=origin,
            lab_proxy_secret=SECRET,
        )
