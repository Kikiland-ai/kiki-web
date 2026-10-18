"""Authenticated lab relay over deterministic doubles: no cloud, pixels or provider calls."""

import asyncio
import hashlib
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from copy import deepcopy
from pathlib import Path
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
        self.lose_create_response = False
        self.created = {}
        self.lock = threading.Lock()
        self.stream_gate = None
        self.definition = json.loads(
            Path(__file__).with_name("lab-input-definition.json").read_text()
        )
        self.policy = json.loads(Path(__file__).with_name("lab-input-policy.json").read_text())

    async def request(self, method, path, uid, body=None, operation_key=None):
        self.calls.append((method, path, uid, deepcopy(body), operation_key))
        if method == "POST" and path == "/lab-sessions":
            await asyncio.sleep(0.02)
            if self.fail_create:
                raise BoundaryError(503, "Lab tracking is unavailable; your progress is kept.")
            # Mirrors kiki-backend's durable Idempotency-Key replay for lab creation.
            with self.lock:
                replay = self.created.get((uid, operation_key))
                if replay and replay[0] != body:
                    raise BoundaryError(409, "The lab changed. Refresh before trying again.")
                if not replay:
                    replay = self.created[(uid, operation_key)] = (deepcopy(body), str(uuid4()))
                    self.states[replay[1]] = {
                        "lab_session_id": replay[1],
                        "experiment_id": "PR-AM-DSB",
                        "revision": 1,
                        "status": "active",
                        "runtime": {"capture_status": "disconnected"},
                        "definition": {
                            "definition_sha256": hashlib.sha256(
                                json.dumps(
                                    self.definition,
                                    sort_keys=True,
                                    separators=(",", ":"),
                                    ensure_ascii=False,
                                ).encode()
                            ).hexdigest()
                        },
                    }
            if self.lose_create_response:
                raise BoundaryError(503, "Lab tracking is unavailable; your progress is kept.")
            value = self.states[replay[1]]
        elif path == "/lab-definition":
            value = self.definition
        elif path == "/lab-guidance-policy":
            value = self.policy
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
    # Racing starts share one reservation; any repeated POST replays its key and body.
    assert all(r.status_code == 200 for r in responses)
    value = client.post(path, headers=headers(), json={}).json()
    assert {r.json()["backendLabId"] for r in responses} == {value["backendLabId"]}
    creates = [c for c in upstream.calls if c[1] == "/lab-sessions"]
    assert creates[0][4] and len({(c[2], c[4], json.dumps(c[3])) for c in creates}) == 1
    assert creates[0][2] == "a" and creates[0][3]["progression_mode"] == "screen_guided"
    assert list(upstream.states) == [value["backendLabId"]]
    records = [v for k, v in store.docs.items() if "/labExecutions/" in k]
    assert len(records) == 1 and records[0]["backendLabId"] == value["backendLabId"]
    assert not records[0].get("frames") and "token" not in records[0]


def test_lost_create_response_is_replayed_with_the_saved_key_and_body(execution):
    client, _, _, upstream, store, path = execution
    upstream.lose_create_response = True
    assert client.post(path, headers=headers(), json={}).status_code == 503
    assert len(upstream.states) == 1
    # Reload can now distinguish this recoverable reservation from an outage.
    pending = client.get(path, headers=headers())
    assert pending.status_code == 503
    assert pending.json()["code"] == "lab_creation_pending"
    assert "operationKey" not in pending.text and "modelName" not in pending.text
    # A later edit to the preparation must not change the replayed create body.
    store.docs[f"learners/a/labPreparations/{path.split('/')[2]}"]["projectRef"] = "Edited.slx"
    upstream.lose_create_response = False
    value = linked(execution)
    creates = [c for c in upstream.calls if c[1] == "/lab-sessions"]
    assert len(creates) == 2 and creates[0][4] and creates[0][3:] == creates[1][3:]
    assert creates[1][3]["model_name"] == "dsb_sc"
    assert list(upstream.states) == [value["backendLabId"]]
    record = next(v for k, v in store.docs.items() if "/labExecutions/" in k)
    assert record["status"] == "linked" and record["backendLabId"] == value["backendLabId"]


def test_linked_or_legacy_reservations_read_instead_of_creating(execution):
    client, _, _, upstream, store, path = execution
    value = linked(execution)
    assert linked(execution)["backendLabId"] == value["backendLabId"]
    creates = [c for c in upstream.calls if c[1] == "/lab-sessions"]
    assert len(creates) == 1
    assert upstream.calls[-1][:2] == ("GET", f"/lab-sessions/{value['backendLabId']}")
    # A reservation saved without its create body cannot be replayed safely.
    record = next(v for k, v in store.docs.items() if "/labExecutions/" in k)
    for key in ("backendLabId", "modelName"):
        record.pop(key)
    record["status"] = "creating"
    legacy = client.get(path, headers=headers())
    assert legacy.status_code == 503 and "code" not in legacy.json()
    assert client.post(path, headers=headers(), json={}).status_code == 503
    assert len([c for c in upstream.calls if c[1] == "/lab-sessions"]) == 1


def test_http_response_loss_after_upstream_commit_recovers_the_same_execution(execution):
    client, _, services, upstream, _, path = execution
    drop = True

    async def remote(request):
        nonlocal drop
        content, mime = await upstream.request(
            request.method,
            request.url.path,
            request.headers["x-kiki-owner"],
            json.loads(request.content) if request.content else None,
            request.headers.get("idempotency-key"),
        )
        if request.method == "POST" and request.url.path == "/lab-sessions" and drop:
            drop = False
            # Commit happened; transport fails before apps/api receives any response.
            raise httpx.ReadError("Controlled dropped create response", request=request)
        return httpx.Response(200, content=content, headers={"Content-Type": mime})

    settings = Settings(
        _env_file=None,
        lab_execution_mode="local",
        firebase_project_id="unit-test-project",
        lab_backend_origin="http://127.0.0.1:8100",
        lab_proxy_secret=SECRET,
    )
    services.lab_executions.upstream = LabUpstream(settings, httpx.MockTransport(remote))
    assert client.post(path, headers=headers(), json={}).status_code == 503
    assert len(upstream.states) == 1
    pending = client.get(path, headers=headers())
    assert pending.json()["code"] == "lab_creation_pending"
    recovered = client.post(path, headers=headers(), json={"recoverPending": True})
    assert recovered.status_code == 200
    lab_id = recovered.json()["backendLabId"]
    assert list(upstream.states) == [lab_id]
    assert client.get(path, headers=headers()).json()["backendLabId"] == lab_id
    creates = [c for c in upstream.calls if c[1] == "/lab-sessions"]
    assert len(creates) == 2 and creates[0][3:] == creates[1][3:]


def test_recovery_never_reserves_a_new_operation_and_linked_recovery_is_read_only(execution):
    client, _, _, upstream, store, path = execution
    assert client.post(path, headers=headers(), json={"recoverPending": True}).status_code == 404
    assert not upstream.states
    value = linked(execution)
    upstream.states[value["backendLabId"]]["status"] = "completed"
    recovered = client.post(path, headers=headers(), json={"recoverPending": True})
    assert recovered.json()["backendLabId"] == value["backendLabId"]
    assert recovered.json()["state"]["status"] == "completed"
    assert len([c for c in upstream.calls if c[1] == "/lab-sessions"]) == 1
    key = next(k for k in store.docs if "/labExecutions/" in k)
    del store.docs[key]
    assert client.post(path, headers=headers(), json={"recoverPending": True}).status_code == 404
    assert key not in store.docs
    assert len(upstream.states) == 1


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


def test_current_input_requirements_are_owner_protected_and_definition_bound(execution):
    client, _, _, upstream, _, path = execution
    linked(execution)
    assert client.get(path + "/requirements").status_code == 401
    assert client.get(path + "/requirements", headers=headers("b")).status_code == 404
    response = client.get(path + "/requirements", headers=headers())
    assert response.status_code == 200, response.text
    value = response.json()
    assert value["schema"] == "lab-input-requirements/v1"
    assert len(value["checkpoints"]) == 12
    first = value["checkpoints"][0]
    assert first["criteria"][0]["id"] == "CP-DSB-01:workspace"
    assert (
        first["criteria"][0]["description"]
        == upstream.definition["checkpoints"][0]["completion_criteria"][0]["description"]
    )
    assert value["checkpoints"][9]["criteria"][1]["responseKinds"] == ["observation"]
    assert value["checkpoints"][10]["condition"] == "phase_fault"
    assert value["checkpoints"][11]["criteria"][-1]["responseKinds"] == ["explanation"]
    receipt = Path("test-artifacts/lab-input-requirements.json")
    receipt.parent.mkdir(exist_ok=True)
    receipt.write_text(json.dumps(value, ensure_ascii=False) + "\n", encoding="utf-8")
    upstream.definition["checkpoints"][0]["completion_criteria"][0]["description"] = (
        "Changed server definition"
    )
    assert client.get(path + "/requirements", headers=headers()).status_code == 503


def test_invalid_input_policy_is_not_projected_as_current_requirements(execution):
    client, _, _, upstream, _, path = execution
    linked(execution)
    upstream.policy["schema"] = "unknown-policy/v99"
    assert client.get(path + "/requirements", headers=headers()).status_code == 503


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
