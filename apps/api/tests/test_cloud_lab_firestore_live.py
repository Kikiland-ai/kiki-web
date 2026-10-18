"""Opt-in real named-Firestore ticket contention; creates/deletes only a unique test UID."""

import os
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from kiki_api.backend import BoundaryError
from kiki_api.lab_tickets import FirestoreTicketStore, StreamTickets


def test_actual_two_client_ticket_consumption():
    project = os.environ.get("KIKI_TICKET_TEST_PROJECT")
    database = os.environ.get("KIKI_TICKET_TEST_DATABASE")
    if not project or not database or database == "(default)":
        pytest.skip("Explicit project and named database required for live write test")
    from google.cloud import firestore

    credentials = None
    account = os.environ.get("KIKI_TICKET_TEST_GCLOUD_ACCOUNT")
    if account:
        from google.oauth2.credentials import Credentials

        executable = shutil.which("gcloud.cmd") or shutil.which("gcloud")
        if not executable:
            raise RuntimeError("gcloud unavailable for explicitly selected test identity")
        result = subprocess.run(
            [executable, "auth", "print-access-token", "--account", account],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode or not result.stdout.strip():
            raise RuntimeError("Approved cloud test identity is unavailable")
        credentials = Credentials(token=result.stdout.strip())
    clients = [
        firestore.Client(project=project, database=database, credentials=credentials)
        for _ in range(2)
    ]
    workers = [
        StreamTickets("test-only-" + "x" * 32, store=lambda c=c: FirestoreTicketStore(c))
        for c in clients
    ]
    uid = "ticket-contract-" + uuid4().hex
    origin = "https://kiki-512012.web.app"
    grant = {"uid": uid, "auth_time": int(time.time()), "exp": int(time.time()) + 120}
    try:
        value = workers[0].issue(uid, "synthetic-prep", "synthetic-screen", grant, origin)
        record = clients[1].collection("labStreamCapabilities").document(uid).get().to_dict()
        assert "token" not in str(record)

        def take(worker):
            try:
                return worker.consume(value, "synthetic-prep", "synthetic-screen", origin)["uid"]
            except BoundaryError as exc:
                assert exc.status == 401
                return None

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(take, workers))
        assert results.count(uid) == 1 and results.count(None) == 1
    finally:
        clients[0].collection("labStreamCapabilities").document(uid).delete()
        for client in clients:
            client.close()
