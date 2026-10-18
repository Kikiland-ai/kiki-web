"""Single-use, 60-second, worker-local WebSocket opening capabilities.

Firebase bearer tokens stay in memory, never inside tickets, URLs or Firestore.
Local execution uses one API worker. Other workers reject unknown tickets safely.
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
    def __init__(self, secret, clock=time.time):
        self.key = hmac.digest(secret.encode(), b"kiki-lab-stream/v1", "sha256")
        self.clock = clock
        self.pending = {}
        self.lock = threading.Lock()

    def issue(self, uid, prep, sid, token):
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
            self.pending[nonce] = {**value, "token": token}
            body = (
                base64.urlsafe_b64encode(
                    json.dumps({**value, "nonce": nonce}, separators=(",", ":")).encode()
                )
                .decode()
                .rstrip("=")
            )
            signature = hmac.new(self.key, body.encode(), hashlib.sha256).hexdigest()
            return f"{body}.{signature}"

    def consume(self, ticket, prep, sid):
        try:
            if len(ticket) > 2048:
                raise ValueError()
            body, signature = ticket.split(".")
            expected = hmac.new(self.key, body.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError()
            value = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
            with self.lock:
                saved = self.pending.get(value["nonce"])
                if (
                    not saved
                    or saved["exp"] <= self.clock()
                    or value["prep"] != prep
                    or value["sid"] != sid
                    or any(value[k] != saved[k] for k in ("uid", "prep", "sid", "exp"))
                ):
                    raise ValueError()
                del self.pending[value["nonce"]]
                return saved
        except (ValueError, KeyError, TypeError):
            raise BoundaryError(401, "Open a fresh lab connection from Lab mode.") from None
