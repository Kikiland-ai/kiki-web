"""Owned preparation → one reserved upstream execution. No frames or evidence are saved here."""

import hashlib
import json
import re
import time
from uuid import uuid4

import anyio
from firebase_admin import firestore

from .backend import BoundaryError
from .lab_execution_models import ExecutionEnvelope, ExecutionLink, ExecutionRequirements
from .lab_upstream import UNAVAILABLE
from .learning import now
from .learning_catalog import dump

SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,128}$")


def monitoring(state):
    if state.get("status") == "completed":
        return "completed"
    if state.get("status") == "paused":
        return "paused"
    runtime = state.get("runtime", {})
    return (
        "active"
        if runtime.get("capture_active") or runtime.get("capture_status") == "sharing"
        else "disconnected"
    )


class LabExecutions:
    def __init__(self, preparations, upstream):
        self.preparations = preparations
        self.client = preparations.client
        self.upstream = upstream

    def access(self, uid, prep_id):
        self.preparations.learning.access(uid)
        return self.preparations.record(uid, prep_id)

    def ref(self, uid, prep_id):
        return self.preparations.learning.owner_ref(uid, "labExecutions", prep_id)

    def link(self, uid, prep_id):
        self.access(uid, prep_id)
        saved = self.ref(uid, prep_id).get(timeout=5)
        if not saved.exists:
            raise BoundaryError(404, "Start screen sharing from this lab preparation first.")
        value = ExecutionLink.model_validate(saved.to_dict())
        if value.status == "creating" and value.modelName and value.operationKey:
            raise BoundaryError(
                503,
                "Your saved lab creation is pending. Retry to recover the same lab.",
                code="lab_creation_pending",
            )
        if value.status != "linked" or not value.backendLabId:
            raise BoundaryError(503, UNAVAILABLE)
        if not SAFE_ID.fullmatch(value.backendLabId):
            raise BoundaryError(503, UNAVAILABLE)
        return value

    async def call(self, method, path, uid, body=None, operation_key=None):
        content, _ = await self.upstream.request(method, path, uid, body, operation_key)
        try:
            return json.loads(content)
        except (ValueError, TypeError):
            raise BoundaryError(503, UNAVAILABLE) from None

    def reserve(self, uid, prep_id):
        prep = self.access(uid, prep_id)
        ref = self.ref(uid, prep_id)

        @firestore.transactional
        def apply(transaction):
            saved = ref.get(transaction=transaction, timeout=5)
            if saved.exists:
                return False, ExecutionLink.model_validate(saved.to_dict()), prep
            link = ExecutionLink(
                contentVersion=prep.contentVersion,
                createdAt=now(),
                operationKey=str(uuid4()),
                modelName=prep.projectRef[:160].strip() or "dsb_sc",
            )
            transaction.create(ref, dump(link))
            return True, link, prep

        return apply(self.client.transaction(max_attempts=3))

    def existing_reservation(self, uid, prep_id):
        self.access(uid, prep_id)
        saved = self.ref(uid, prep_id).get(timeout=5)
        if not saved.exists:
            raise BoundaryError(
                404, "The saved creation is no longer available. Reopen this preparation."
            )
        return ExecutionLink.model_validate(saved.to_dict())

    async def start(self, uid, prep_id, recover_pending=False):
        if recover_pending:
            winner = False
            link = await anyio.to_thread.run_sync(self.existing_reservation, uid, prep_id)
        else:
            winner, link, _ = await anyio.to_thread.run_sync(self.reserve, uid, prep_id)
        if winner or (link.status == "creating" and link.modelName):
            # A creating reservation may have lost its first response. The same key and
            # body replay that lab instead of creating another; this requires kiki-backend
            # main with idempotent lab creation (durable Idempotency-Key replay).
            return await self.create(uid, prep_id, link)
        # Linked, or reserved before the create body was saved: never repeat that POST.
        return await self.read(uid, prep_id)

    async def create(self, uid, prep_id, link):
        state = await self.call(
            "POST",
            "/lab-sessions",
            uid,
            {
                "operator_trial": True,
                "model_name": link.modelName,
                "progression_mode": "screen_guided",
            },
            link.operationKey,
        )
        lab_id = state.get("lab_session_id")
        if not isinstance(lab_id, str) or not SAFE_ID.fullmatch(lab_id):
            raise BoundaryError(503, UNAVAILABLE)
        self.validate_state(state, lab_id)
        # Only the link fields: a concurrent replay must not reset recorded screen sessions.
        changes = {
            "backendLabId": lab_id,
            "status": "linked",
            "monitoring": monitoring(state),
            "monitoringAt": time.time(),
        }
        await anyio.to_thread.run_sync(lambda: self.update_link(uid, prep_id, changes))
        return self.envelope(prep_id, lab_id, state)

    @staticmethod
    def validate_state(state, lab_id):
        if (
            not isinstance(state, dict)
            or state.get("lab_session_id") != lab_id
            or state.get("experiment_id") != "PR-AM-DSB"
        ):
            raise BoundaryError(503, UNAVAILABLE)

    @staticmethod
    def envelope(prep_id, lab_id, state):
        return ExecutionEnvelope(preparationId=prep_id, backendLabId=lab_id, state=state)

    async def read(self, uid, prep_id):
        link = await anyio.to_thread.run_sync(self.link, uid, prep_id)
        state = await self.call("GET", f"/lab-sessions/{link.backendLabId}", uid)
        self.validate_state(state, link.backendLabId)
        await self.remember(uid, prep_id, state)
        return self.envelope(prep_id, link.backendLabId, state)

    async def requirements(self, uid, prep_id):
        """Project current server-authored policy; no duplicated checkpoint rules in React."""
        envelope = await self.read(uid, prep_id)
        definition = await self.call("GET", "/lab-definition", uid)
        policy = await self.call("GET", "/lab-guidance-policy", uid)
        digest = hashlib.sha256(
            json.dumps(
                definition, sort_keys=True, separators=(",", ":"), ensure_ascii=False
            ).encode()
        ).hexdigest()
        if digest != envelope.state.get("definition", {}).get("definition_sha256"):
            raise BoundaryError(
                503, "Lab instructions changed. Reopen this lab before recording input."
            )
        try:
            value = ExecutionRequirements(
                preparationId=prep_id,
                backendLabId=envelope.backendLabId,
                definitionSha256=digest,
                policySchema=policy["schema"],
                checkpoints=[
                    {
                        "id": cp["id"],
                        "criteria": [
                            {
                                "id": criterion["id"],
                                "description": criterion["description"],
                                "responseKinds": policy["responses"].get(criterion["id"], []),
                            }
                            for criterion in cp["completion_criteria"]
                        ],
                        "condition": policy["conditions"][cp["id"]],
                        "responsePrompt": policy["response_copy"].get(cp["id"]),
                    }
                    for cp in definition["checkpoints"]
                ],
            )
            ids = [cp.id for cp in value.checkpoints]
            if len(set(ids)) != 12 or any(
                len({c.id for c in cp.criteria}) != len(cp.criteria)
                or any(not c.id.startswith(cp.id + ":") for c in cp.criteria)
                for cp in value.checkpoints
            ):
                raise ValueError("Invalid criterion identity")
            return value
        except (KeyError, TypeError, ValueError):
            raise BoundaryError(
                503, "The lab input instructions are unavailable. Retry shortly."
            ) from None

    async def remember(self, uid, prep_id, state):
        # Only cache connection status, never inferred checkpoint evidence or pixels.
        await anyio.to_thread.run_sync(
            lambda: self.update_link(
                uid, prep_id, {"monitoring": monitoring(state), "monitoringAt": time.time()}
            )
        )

    def update_link(self, uid, prep_id, changes):
        ref = self.ref(uid, prep_id)

        @firestore.transactional
        def apply(transaction):
            saved = ref.get(transaction=transaction, timeout=5)
            if not saved.exists:
                raise BoundaryError(503, UNAVAILABLE)
            transaction.update(ref, changes)

        apply(self.client.transaction(max_attempts=3))

    async def mutate(self, uid, prep_id, action, body):
        link = await anyio.to_thread.run_sync(self.link, uid, prep_id)
        if action == "attach":
            self.owns_screen(link, body.capture_session_id)
        state = await self.call(
            "POST",
            f"/lab-sessions/{link.backendLabId}/{action}",
            uid,
            body.model_dump(exclude_none=True),
        )
        self.validate_state(state, link.backendLabId)
        await self.remember(uid, prep_id, state)
        return self.envelope(prep_id, link.backendLabId, state)

    @staticmethod
    def owns_screen(link, sid):
        if sid not in link.screenSessions:
            raise BoundaryError(404, "This screen session was not found for your preparation.")

    async def screen(self, uid, prep_id):
        link = await anyio.to_thread.run_sync(self.link, uid, prep_id)
        if len(link.screenSessions) >= 20:
            raise BoundaryError(429, "This lab has reached its screen-session limit.")
        value = await self.call("POST", "/screen-sessions", uid)
        sid = value.get("session_id")
        if not isinstance(sid, str) or not SAFE_ID.fullmatch(sid):
            raise BoundaryError(503, UNAVAILABLE)
        ref = self.ref(uid, prep_id)

        @firestore.transactional
        def record(transaction):
            saved = ExecutionLink.model_validate(
                ref.get(transaction=transaction, timeout=5).to_dict()
            )
            if len(saved.screenSessions) >= 20:
                raise BoundaryError(429, "This lab has reached its screen-session limit.")
            transaction.update(ref, {"screenSessions": [*saved.screenSessions, sid]})

        await anyio.to_thread.run_sync(lambda: record(self.client.transaction(max_attempts=3)))
        return {
            k: value[k]
            for k in (
                "session_id",
                "sample_interval_ms",
                "max_frame_bytes",
                "session_limit_seconds",
            )
            if k in value
        }

    def status(self, uid, prep_id):
        saved = self.ref(uid, prep_id).get(timeout=5)
        if not saved.exists:
            return "pending_integration"
        value = ExecutionLink.model_validate(saved.to_dict())
        if value.monitoring in {"connecting", "active"} and time.time() - value.monitoringAt > 20:
            return "disconnected"
        return value.monitoring

    def disconnected(self, uid, prep_id):
        ref = self.ref(uid, prep_id)

        @firestore.transactional
        def apply(transaction):
            saved = ref.get(transaction=transaction, timeout=5)
            if saved.exists and saved.to_dict().get("monitoring") not in {"paused", "completed"}:
                transaction.update(ref, {"monitoring": "disconnected", "monitoringAt": time.time()})

        apply(self.client.transaction(max_attempts=3))
