"""Tutor session storage. The server owns state; the event log is append-only.

Firestore layout (owner-scoped, written only by the API's admin credentials):
  learners/{uid}/tutorSessions/{sid}            state, lastResponse, question, timestamps
  learners/{uid}/tutorSessions/{sid}/events/{seq:06d}
  learners/{uid}/tutorSessions/{sid}/turns/{idempotencyKey}   the response, for exact replay
Each turn commits state + events + turn record in one transaction guarded by state.version.
"""

from typing import Protocol

from .session import Event, TutorState


class Conflict(Exception):
    """Another turn changed the session first (stale version)."""


class Missing(Exception):
    """No such session for this learner."""


class TutorStore(Protocol):
    def create(
        self, uid: str, sid: str, state: TutorState, events: list[Event], response: dict
    ) -> None: ...
    def load(self, uid: str, sid: str) -> tuple[TutorState, dict]: ...
    def turn_response(self, uid: str, sid: str, key: str) -> dict | None: ...
    def commit(
        self,
        uid: str,
        sid: str,
        expected_version: int,
        state: TutorState,
        events: list[Event],
        key: str,
        response: dict,
    ) -> dict: ...
    def append(
        self, uid: str, sid: str, expected_version: int, state: TutorState, events: list[Event]
    ) -> None: ...
    def events(self, uid: str, sid: str) -> list[Event]: ...
    def get_report(self, uid: str, sid: str) -> dict | None: ...
    def put_report(self, uid: str, sid: str, report: dict) -> None: ...


def _dump(model) -> dict:
    return model.model_dump(by_alias=True, exclude_none=True)


class FirestoreTutorStore:
    def __init__(self, client):
        from firebase_admin import firestore

        self.client, self.fs = client, firestore

    def _session(self, uid, sid):
        return (
            self.client.collection("learners")
            .document(uid)
            .collection("tutorSessions")
            .document(sid)
        )

    def create(self, uid, sid, state, events, response):
        ref = self._session(uid, sid)
        fs = self.fs

        @fs.transactional
        def apply(tx):
            if ref.get(transaction=tx).exists:
                raise Conflict("session exists")
            tx.create(
                ref,
                {
                    "state": _dump(state),
                    "lastResponse": response,
                    "questionId": state.questionId,
                    "createdAt": fs.SERVER_TIMESTAMP,
                    "updatedAt": fs.SERVER_TIMESTAMP,
                },
            )
            for e in events:
                tx.create(ref.collection("events").document(f"{e.seq:06d}"), _dump(e))

        apply(self.client.transaction(max_attempts=3))

    def load(self, uid, sid):
        snap = self._session(uid, sid).get()
        if not snap.exists:
            raise Missing(sid)
        data = snap.to_dict()
        return TutorState.model_validate(data["state"]), data.get("lastResponse") or {}

    def turn_response(self, uid, sid, key):
        snap = self._session(uid, sid).collection("turns").document(key).get()
        return snap.to_dict()["response"] if snap.exists else None

    def commit(self, uid, sid, expected_version, state, events, key, response):
        ref = self._session(uid, sid)
        turn_ref = ref.collection("turns").document(key)
        fs = self.fs

        @fs.transactional
        def apply(tx):
            snap, done = ref.get(transaction=tx), turn_ref.get(transaction=tx)
            if not snap.exists:
                raise Missing(sid)
            if done.exists:  # duplicate delivery: replay, don't move again
                return done.to_dict()["response"]
            if snap.to_dict()["state"]["version"] != expected_version:
                raise Conflict("stale version")
            tx.update(
                ref,
                {"state": _dump(state), "lastResponse": response, "updatedAt": fs.SERVER_TIMESTAMP},
            )
            tx.create(turn_ref, {"response": response, "at": fs.SERVER_TIMESTAMP})
            for e in events:
                tx.create(ref.collection("events").document(f"{e.seq:06d}"), _dump(e))
            return response

        return apply(self.client.transaction(max_attempts=3))

    def append(self, uid, sid, expected_version, state, events):
        ref = self._session(uid, sid)
        fs = self.fs

        @fs.transactional
        def apply(tx):
            snap = ref.get(transaction=tx)
            if not snap.exists:
                raise Missing(sid)
            if snap.to_dict()["state"]["version"] != expected_version:
                raise Conflict("stale version")
            tx.update(ref, {"state": _dump(state), "updatedAt": fs.SERVER_TIMESTAMP})
            for e in events:
                tx.create(ref.collection("events").document(f"{e.seq:06d}"), _dump(e))

        apply(self.client.transaction(max_attempts=3))

    def events(self, uid, sid):
        docs = self._session(uid, sid).collection("events").order_by("seq").stream()
        return [Event.model_validate(d.to_dict()) for d in docs]

    def get_report(self, uid, sid):
        snap = self._session(uid, sid).get()
        if not snap.exists:
            raise Missing(sid)
        return snap.to_dict().get("report")

    def put_report(self, uid, sid, report):
        self._session(uid, sid).update({"report": report})


class MemoryTutorStore:
    """In-process store with the same semantics. For tests and local fixture mode only."""

    def __init__(self):
        self.sessions: dict[tuple[str, str], dict] = {}

    def create(self, uid, sid, state, events, response):
        if (uid, sid) in self.sessions:
            raise Conflict("session exists")
        self.sessions[(uid, sid)] = {
            "state": state.model_copy(deep=True),
            "events": list(events),
            "turns": {},
            "last": response,
        }

    def _get(self, uid, sid):
        try:
            return self.sessions[(uid, sid)]
        except KeyError:
            raise Missing(sid) from None

    def load(self, uid, sid):
        s = self._get(uid, sid)
        return s["state"].model_copy(deep=True), s["last"]

    def turn_response(self, uid, sid, key):
        return self._get(uid, sid)["turns"].get(key)

    def commit(self, uid, sid, expected_version, state, events, key, response):
        s = self._get(uid, sid)
        if key in s["turns"]:
            return s["turns"][key]
        if s["state"].version != expected_version:
            raise Conflict("stale version")
        s.update(state=state.model_copy(deep=True), last=response)
        s["turns"][key] = response
        s["events"].extend(events)
        return response

    def append(self, uid, sid, expected_version, state, events):
        s = self._get(uid, sid)
        if s["state"].version != expected_version:
            raise Conflict("stale version")
        s["state"] = state.model_copy(deep=True)
        s["events"].extend(events)

    def events(self, uid, sid):
        return list(self._get(uid, sid)["events"])

    def get_report(self, uid, sid):
        return self._get(uid, sid).get("report")

    def put_report(self, uid, sid, report):
        self._get(uid, sid)["report"] = report
