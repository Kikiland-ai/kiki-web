"""Credential-free boundary tests; live multi-instance acceptance is separate."""

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from types import SimpleNamespace

import httpx
import pytest
from pydantic import SecretStr
from test_learning import Store, Transaction

from kiki_api.backend import BoundaryError, FirebaseVerifier
from kiki_api.lab_tickets import FirestoreTicketStore, StreamTickets
from kiki_api.lab_upstream import LabUpstream


def ticket_store(monkeypatch):
    store = Store()
    lock = threading.Lock()

    def serial(fn):
        def apply(tx):
            with lock:
                result = fn(tx)
                tx.commit()
                return result

        return apply

    monkeypatch.setattr("firebase_admin.firestore.transactional", serial)
    monkeypatch.setattr(Transaction, "delete", lambda self, ref: self.set(ref, {}), raising=False)
    return store


def test_cross_worker_single_consumer_and_no_persisted_bearer(monkeypatch):
    store = ticket_store(monkeypatch)
    now = [100.0]

    def worker():
        return StreamTickets("x" * 32, lambda: now[0], lambda: FirestoreTicketStore(store))

    a, b = worker(), worker()
    grant = {"uid": "alice", "auth_time": 90, "exp": 1000}
    value = a.issue("alice", "prep", "screen", grant, "https://kiki-512012.web.app")
    assert "token" not in str(store.docs)

    def consume():
        try:
            return b.consume(value, "prep", "screen", "https://kiki-512012.web.app")["grant"]
        except BoundaryError:
            return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: consume(), range(2)))
    assert results.count(grant) == 1 and results.count(None) == 1
    for wrong in [
        ("foreign", "screen", "https://kiki-512012.web.app"),
        ("prep", "foreign", "https://kiki-512012.web.app"),
        ("prep", "screen", "https://foreign.example"),
    ]:
        value = a.issue("alice", "prep", "screen", grant, "https://kiki-512012.web.app")
        with pytest.raises(BoundaryError):
            b.consume(value, *wrong)
    value = a.issue("alice", "prep", "screen", grant)
    now[0] += 61
    with pytest.raises(BoundaryError):
        b.consume(value, "prep", "screen")


def test_grant_rechecks_revocation_disabled_and_expiry(monkeypatch):
    verifier = FirebaseVerifier(None)
    user = SimpleNamespace(
        uid="alice", display_name="Alice", disabled=False, tokens_valid_after_timestamp=0
    )
    monkeypatch.setattr("kiki_api.backend.auth.get_user", lambda *args, **kw: user)
    monkeypatch.setattr("time.time", lambda: 100)
    grant = {"uid": "alice", "auth_time": 90, "exp": 200}
    assert verifier.verify_stream_grant(grant).uid == "alice"
    for field, value in [("disabled", True), ("tokens_valid_after_timestamp", 91000)]:
        old = getattr(user, field)
        setattr(user, field, value)
        with pytest.raises(BoundaryError):
            verifier.verify_stream_grant(grant)
        setattr(user, field, old)
    with pytest.raises(BoundaryError):
        verifier.verify_stream_grant({**grant, "exp": 100})


def test_private_identity_header_on_http_sse_and_websocket(monkeypatch):
    origin = "https://private-engine.example.run.app"
    settings = SimpleNamespace(
        lab_backend_origin=origin, lab_proxy_secret=SecretStr("x" * 32), lab_execution_mode="cloud"
    )
    audiences, seen = [], []

    def mint(audience):
        audiences.append(audience)
        return "test-service-identity"

    def remote(request):
        seen.append(dict(request.headers))
        return httpx.Response(
            200, headers={"Content-Type": "text/event-stream"}, content=b"data: ok\n\n"
        )

    @asynccontextmanager
    async def socket(*args, **kwargs):
        seen.append({k.lower(): v for k, v in kwargs["additional_headers"].items()})
        yield object()

    monkeypatch.setattr("kiki_api.lab_upstream.connect", socket)
    upstream = LabUpstream(settings, httpx.MockTransport(remote), mint)

    async def run():
        await upstream.request("GET", "/lab-sessions/lab", "alice")
        async with upstream.stream("/lab-sessions/lab/check-stream", "alice", {}) as chunks:
            async for _ in chunks:
                pass
        async with upstream.socket("screen", "alice"):
            pass

    asyncio.run(run())
    assert audiences == [origin] * 3
    assert all(
        h["authorization"] == "Bearer test-service-identity"
        and h["x-kiki-owner"] == "fb:alice"
        and "cookie" not in h
        for h in seen
    )
