"""Single-use 60-second capabilities; cloud stores verified identity metadata only.

Local bearer tokens remain worker-local. Cloud consumption is transactional.
"""

import base64
import hashlib
import hmac
import json
import threading
import time
from uuid import uuid4

from .backend import BoundaryError


class StreamTickets:
    def __init__(self, secret, clock=time.time, store=None):
        self.key = hmac.digest(secret.encode(), b"kiki-lab-stream/v1", "sha256")
        self.clock = clock
        self.pending = {}
        self.lock = threading.Lock()
        self.store = store

    def issue(self, uid, prep, sid, token, origin=None):
        with self.lock:
            now = self.clock()
            self.pending = {k: v for k, v in self.pending.items() if v["exp"] > now}
            if (
                len(self.pending) >= 4096
                or sum(v["uid"] == uid for v in self.pending.values()) >= 8
            ):
                raise BoundaryError(429, "Wait before opening another lab connection.")
            nonce = uuid4().hex
            value = {"uid": uid, "prep": prep, "sid": sid, "exp": now + 60}
            if origin is not None:
                value["origin"] = origin
            saved = {**value, **({"grant": token} if self.store else {"token": token})}
            if self.store:
                self.store().put(nonce, saved, now)
            else:
                self.pending[nonce] = saved
            body = (
                base64.urlsafe_b64encode(
                    json.dumps({**value, "nonce": nonce}, separators=(",", ":")).encode()
                )
                .decode()
                .rstrip("=")
            )
            signature = hmac.new(self.key, body.encode(), hashlib.sha256).hexdigest()
            return f"{body}.{signature}"

    def consume(self, ticket, prep, sid, origin=None):
        try:
            if len(ticket) > 2048:
                raise ValueError()
            body, signature = ticket.split(".")
            expected = hmac.new(self.key, body.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError()
            value = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
            with self.lock:
                if (
                    value["prep"] != prep
                    or value["sid"] != sid
                    or ("origin" in value and value["origin"] != origin)
                ):
                    raise ValueError()
                saved = (
                    self.store().take(value, self.clock())
                    if self.store
                    else self.pending.get(value["nonce"])
                )
                if (
                    not saved
                    or saved["exp"] <= self.clock()
                    or value["prep"] != prep
                    or value["sid"] != sid
                    or any(value[k] != saved[k] for k in ("uid", "prep", "sid", "exp"))
                ):
                    raise ValueError()
                if not self.store:
                    del self.pending[value["nonce"]]
                return saved
        except (ValueError, KeyError, TypeError):
            raise BoundaryError(401, "Open a fresh lab connection from Lab mode.") from None


class FirestoreTicketStore:
    """Bounded per-user capability map; no Firebase bearer token is stored."""

    def __init__(self, client):
        self.client = client

    def put(self, nonce, saved, now):
        from firebase_admin import firestore

        if "token" in saved or not isinstance(saved.get("grant"), dict):
            raise ValueError("Cloud tickets require verified identity metadata")
        ref = self.client.collection("labStreamCapabilities").document(saved["uid"])

        @firestore.transactional
        def apply(transaction):
            snapshot = ref.get(transaction=transaction, timeout=5)
            entries = (snapshot.to_dict() or {}).get("entries", {})
            entries = {k: v for k, v in entries.items() if v["exp"] > now}
            if len(entries) >= 8:
                raise BoundaryError(429, "Wait before opening another lab connection.")
            entries[nonce] = saved
            transaction.set(ref, {"entries": entries})

        apply(self.client.transaction(max_attempts=3))

    def take(self, value, now):
        from firebase_admin import firestore

        ref = self.client.collection("labStreamCapabilities").document(value["uid"])

        @firestore.transactional
        def apply(transaction):
            snapshot = ref.get(transaction=transaction, timeout=5)
            entries = (snapshot.to_dict() or {}).get("entries", {})
            saved = entries.get(value["nonce"])
            if (
                not saved
                or saved["exp"] <= now
                or any(
                    value.get(k) != saved.get(k) for k in ("uid", "prep", "sid", "exp", "origin")
                )
            ):
                raise BoundaryError(401, "Open a fresh lab connection from Lab mode.")
            del entries[value["nonce"]]
            if entries:
                transaction.set(ref, {"entries": entries})
            else:
                transaction.delete(ref)
            return saved

        return apply(self.client.transaction(max_attempts=3))
