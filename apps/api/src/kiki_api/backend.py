from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from firebase_admin import auth, firestore, get_app, initialize_app
from pydantic import ValidationError

from .config import Settings
from .models import Enrollment, Identity, Preferences, Profile, new_profile, saved_preferences, wire

if TYPE_CHECKING:
    from .lab_execution import LabExecutions
    from .lab_preparation import LabPreparations
    from .learning import FirestoreLearning
    from .materials import MaterialLibrary


class BoundaryError(Exception):
    def __init__(self, status: int, message: str, *, code: str | None = None):
        self.status = status
        self.message = message
        self.code = code
        super().__init__(message)


class Verifier(Protocol):
    def verify(self, token: str) -> Identity: ...


class Profiles(Protocol):
    def bootstrap(self, identity: Identity) -> Profile: ...
    def get(self, uid: str) -> Profile: ...
    def update(self, uid: str, update: Preferences) -> Profile: ...
    def enroll(self, uid: str, enrollment: Enrollment) -> Profile: ...


@dataclass
class Services:
    verifier: Verifier
    profiles: Profiles
    materials: "MaterialLibrary | None" = None
    learning: "FirestoreLearning | None" = None
    lab_preparations: "LabPreparations | None" = None
    lab_executions: "LabExecutions | None" = None


class FirebaseVerifier:
    def __init__(self, app):
        self.app = app

    def _verified_claims(self, token):
        try:
            decoded = auth.verify_id_token(token, app=self.app, check_revoked=True)
        except auth.CertificateFetchError as exc:
            raise BoundaryError(503, "Sign-in verification is temporarily unavailable.") from exc
        except (
            auth.InvalidIdTokenError,
            auth.RevokedIdTokenError,
            auth.UserDisabledError,
            auth.UserNotFoundError,
            ValueError,
        ) as exc:
            raise BoundaryError(401, "Your sign-in is invalid or expired. Sign in again.") from exc
        if decoded.get("firebase", {}).get("sign_in_provider") != "google.com":
            raise BoundaryError(403, "Use Sign in with Google for Kiki.")
        return decoded

    def verify(self, token: str) -> Identity:
        decoded = self._verified_claims(token)
        try:
            return Identity(uid=decoded["uid"], display_name=decoded.get("name") or "Student")
        except (KeyError, ValidationError) as exc:
            raise BoundaryError(401, "The signed-in identity is unsupported.") from exc

    def stream_grant(self, token):
        decoded = self._verified_claims(token)
        return {"uid": decoded["uid"], "auth_time": decoded["auth_time"], "exp": decoded["exp"]}

    def verify_stream_grant(self, grant):
        import time

        try:
            user = auth.get_user(grant["uid"], app=self.app)
            if (
                user.disabled
                or grant["exp"] <= time.time()
                or grant["auth_time"] < user.tokens_valid_after_timestamp / 1000
            ):
                raise ValueError()
            return Identity(uid=user.uid, display_name=user.display_name or "Student")
        except (auth.UserNotFoundError, ValueError, KeyError, TypeError) as exc:
            raise BoundaryError(401, "Your sign-in is invalid or expired. Sign in again.") from exc


class FirestoreProfiles:
    """Preserve unrelated learner fields; all mutations run in owner-scoped transactions."""

    def __init__(self, client):
        self.client = client

    def _ref(self, uid: str):
        return self.client.collection("learners").document(uid)

    @staticmethod
    def _read(snapshot, uid: str) -> Profile:
        if not snapshot.exists:
            raise BoundaryError(404, "Your profile was not found. Reopen Kiki to create it.")
        data = snapshot.to_dict()
        fields = {field.alias or name for name, field in Profile.model_fields.items()}
        try:
            profile = Profile.model_validate({k: v for k, v in data.items() if k in fields})
            if profile.id != uid:
                raise ValueError("Owner mismatch")
            return profile
        except (ValueError, ValidationError) as exc:
            raise BoundaryError(503, "Your stored profile needs a compatibility check.") from exc

    def bootstrap(self, identity: Identity) -> Profile:
        ref = self._ref(identity.uid)

        @firestore.transactional
        def apply(transaction):
            snapshot = ref.get(transaction=transaction, timeout=5)
            if snapshot.exists:
                return self._read(snapshot, identity.uid)
            profile = new_profile(identity)
            transaction.create(
                ref,
                {
                    **wire(profile),
                    "createdAt": firestore.SERVER_TIMESTAMP,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                },
            )
            return profile

        return apply(self.client.transaction(max_attempts=3))

    def get(self, uid: str) -> Profile:
        return self._read(self._ref(uid).get(timeout=5), uid)

    def update(self, uid: str, update: Preferences) -> Profile:
        ref = self._ref(uid)

        @firestore.transactional
        def apply(transaction):
            current = self._read(ref.get(transaction=transaction, timeout=5), uid)
            if current.onboarding.completedAt and not update.onboarding.completedAt:
                raise BoundaryError(409, "Onboarding is already complete. Reload your profile.")
            changes = saved_preferences(current, update)
            next_profile = Profile.model_validate({**wire(current), **changes})
            transaction.update(ref, {**changes, "updatedAt": firestore.SERVER_TIMESTAMP})
            return next_profile

        return apply(self.client.transaction(max_attempts=3))

    def enroll(self, uid: str, enrollment: Enrollment) -> Profile:
        ref = self._ref(uid)
        enrollment_ref = ref.collection("enrollments").document(enrollment.courseId)

        @firestore.transactional
        def apply(transaction):
            current = self._read(ref.get(transaction=transaction, timeout=5), uid)
            courses = list(dict.fromkeys([*current.courseIds, enrollment.courseId]))
            transaction.set(
                enrollment_ref,
                {
                    "courseId": enrollment.courseId,
                    "semester": enrollment.semester,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                },
                merge=True,
            )
            transaction.update(
                ref,
                {
                    "courseIds": courses,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                },
            )
            return current.model_copy(update={"courseIds": courses})

        return apply(self.client.transaction(max_attempts=3))


def firebase_services(settings: Settings) -> Services:
    try:
        app = get_app("kiki-profile-api")
    except ValueError:
        app = initialize_app(
            options={
                "projectId": settings.firebase_project_id,
                "httpTimeout": 10,
            },
            name="kiki-profile-api",
        )
    if app.project_id != settings.firebase_project_id:
        raise BoundaryError(503, "The API project does not match its Firebase configuration.")
    client = firestore.client(app=app, database_id=settings.firestore_database)
    from firebase_admin import storage

    from .materials import FirestoreMaterials, MaterialLibrary, PrivateOriginals

    originals = (
        PrivateOriginals(storage.bucket(settings.storage_bucket, app=app))
        if settings.storage_bucket
        else None
    )
    from .concept_media import BucketMediaAssets, ConceptMedia
    from .lab_preparation import LabPreparations
    from .learning import FirestoreLearning

    media_assets = (
        BucketMediaAssets(storage.bucket(settings.media_bucket, app=app))
        if settings.media_bucket
        else None
    )
    profiles = FirestoreProfiles(client)
    learning = FirestoreLearning(client, profiles, ConceptMedia(client, media_assets))
    preparations = LabPreparations(learning)
    executions = None
    if settings.lab_execution_mode != "disabled":
        from .lab_execution import LabExecutions
        from .lab_upstream import LabUpstream

        executions = LabExecutions(preparations, LabUpstream(settings))
        preparations.execution_status = executions.status
    return Services(
        FirebaseVerifier(app),
        profiles,
        MaterialLibrary(FirestoreMaterials(client), originals),
        learning,
        preparations,
        executions,
    )
