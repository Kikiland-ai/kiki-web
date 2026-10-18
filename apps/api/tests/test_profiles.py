from copy import deepcopy
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from kiki_api.backend import BoundaryError, FirebaseVerifier, FirestoreProfiles, Services
from kiki_api.config import Settings
from kiki_api.main import create_app
from kiki_api.models import Identity


class Snapshot:
    def __init__(self, data):
        self.exists = data is not None
        self.data = deepcopy(data)

    def to_dict(self):
        return deepcopy(self.data)


class Ref:
    def __init__(self, client, path):
        self.client, self.path = client, path

    def collection(self, name):
        return Ref(self.client, self.path + "/" + name)

    def document(self, name):
        return Ref(self.client, self.path + "/" + name)

    def get(self, **_kwargs):
        return Snapshot(self.client.docs.get(self.path))


class Transaction:
    def __init__(self, client):
        self.client = client

    def create(self, ref, data):
        assert ref.path not in self.client.docs
        self.client.docs[ref.path] = deepcopy(data)

    def update(self, ref, data):
        self.client.docs[ref.path].update(deepcopy(data))

    def set(self, ref, data, merge):
        assert merge
        self.client.docs.setdefault(ref.path, {}).update(deepcopy(data))


class FirestoreDouble:
    """Test-only storage double. Does not prove Firestore concurrency or cloud IAM."""

    def __init__(self):
        self.docs = {}

    def collection(self, name):
        return Ref(self, name)

    def transaction(self, max_attempts):
        assert max_attempts == 3
        return Transaction(self)


class TestVerifier:
    __test__ = False

    def verify(self, token):
        if token not in {"test-a", "test-b"}:
            raise BoundaryError(401, "Invalid test identity")
        return Identity(uid=token.removeprefix("test-"), display_name="Test learner")


@pytest.fixture
def harness(monkeypatch):
    monkeypatch.delenv("FIREBASE_AUTH_EMULATOR_HOST", raising=False)
    monkeypatch.delenv("FIRESTORE_EMULATOR_HOST", raising=False)
    monkeypatch.setattr("kiki_api.backend.firestore.transactional", lambda function: function)
    store = FirestoreDouble()
    services = Services(TestVerifier(), FirestoreProfiles(store))
    settings = Settings(_env_file=None, firebase_project_id="unit-test-project")
    factory = Mock(return_value=services)
    client = TestClient(create_app(settings, factory), raise_server_exceptions=False)
    return client, store, factory


def headers(user="a"):
    return {"Authorization": "Bearer test-" + user}


def bootstrap(client, user="a"):
    response = client.post("/learners/me/bootstrap", headers=headers(user))
    assert response.status_code == 200, response.text
    return response.json()["profile"]


def preferences(step=3, complete=False):
    return {
        "supportLanguage": "or",
        "dialLevel": 2,
        "onboarding": {
            "step": step,
            "completedAt": "2099-01-01T00:00:00Z" if complete else None,
            "fluencySelfRatings": {
                "support": {"language": "or", "outOf10": 9},
                "englishOutOf10": 3,
                "assessedBy": "self",
            }
            if step >= 2
            else None,
            "easyLanguageAnswer": "regional" if step == 3 else None,
        },
    }


def test_requires_verified_bearer_before_loading_any_backend_credentials(harness):
    client, _, factory = harness
    for method, path in [("post", "/learners/me/bootstrap"), ("get", "/learners/me/profile")]:
        response = getattr(client, method)(path)
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"
    factory.assert_not_called()
    assert (
        client.get("/learners/me/profile", headers={"Authorization": "Bearer forged"}).status_code
        == 401
    )


def test_bootstrap_is_idempotent_owner_scoped_and_does_not_trust_request_uid(harness):
    client, store, _ = harness
    original = bootstrap(client)
    assert original["id"] == "a"
    assert original["onboarding"]["step"] == 0
    response = client.post("/learners/me/bootstrap", headers=headers(), json={"uid": "b"})
    assert response.json()["profile"] == original
    assert set(store.docs) == {"learners/a"}
    assert client.get("/learners/me/profile", headers=headers("b")).status_code == 404
    assert bootstrap(client, "b")["id"] == "b"
    assert client.get("/learners/a/profile", headers=headers("b")).status_code == 404


def test_step_resume_completion_return_and_protected_fields_are_preserved(harness):
    client, store, _ = harness
    bootstrap(client)
    store.docs["learners/a"]["futureLearningEvidence"] = {"keep": True}
    for step in [1, 2, 3]:
        response = client.patch("/learners/me/profile", headers=headers(), json=preferences(step))
        assert response.status_code == 200, response.text
        assert bootstrap(client)["onboarding"]["step"] == step
    response = client.patch(
        "/learners/me/profile", headers=headers(), json=preferences(complete=True)
    )
    saved = response.json()["profile"]
    assert saved["onboarding"]["completedAt"] != "2099-01-01T00:00:00Z"
    assert bootstrap(client) == saved
    assert "futureLearningEvidence" not in saved
    assert store.docs["learners/a"]["futureLearningEvidence"] == {"keep": True}
    replay = client.patch(
        "/learners/me/profile", headers=headers(), json=preferences(complete=True)
    )
    assert (
        replay.json()["profile"]["onboarding"]["completedAt"] == saved["onboarding"]["completedAt"]
    )
    assert (
        client.patch("/learners/me/profile", headers=headers(), json=preferences(1)).status_code
        == 409
    )


@pytest.mark.parametrize(
    "change",
    [
        {"id": "other-owner"},
        {"courseIds": ["CRS-AC-ECE"]},
        {"mastery": 100},
        {"dialLevel": True},
        {"dialLevel": 6},
        {"dialLevel": "2"},
        {
            "onboarding": {
                "step": 3,
                "completedAt": "invalid",
                "fluencySelfRatings": None,
                "easyLanguageAnswer": None,
            }
        },
    ],
)
def test_rejects_invalid_preferences_and_client_identity_mastery_fields(harness, change):
    client, _, _ = harness
    initial = bootstrap(client)
    response = client.patch(
        "/learners/me/profile", headers=headers(), json={**preferences(), **change}
    )
    assert response.status_code == 422
    assert bootstrap(client) == initial


def test_rating_language_and_bounds_must_match(harness):
    client, _, _ = harness
    bootstrap(client)
    bad = preferences()
    bad["onboarding"]["fluencySelfRatings"]["support"]["language"] = "en"
    assert client.patch("/learners/me/profile", headers=headers(), json=bad).status_code == 422
    bad = preferences()
    bad["onboarding"]["fluencySelfRatings"]["englishOutOf10"] = 11
    assert client.patch("/learners/me/profile", headers=headers(), json=bad).status_code == 422


def test_enrollment_is_unique_and_semester_is_stored_without_resetting_preferences(harness):
    client, store, _ = harness
    bootstrap(client)
    client.patch("/learners/me/profile", headers=headers(), json=preferences(2))
    for semester in [5, 5, 6]:
        response = client.post(
            "/learners/me/enrollments",
            headers=headers(),
            json={
                "courseId": "CRS-AC-ECE",
                "semester": semester,
            },
        )
        assert response.status_code == 200
        assert response.json()["profile"]["courseIds"] == ["CRS-AC-ECE"]
        assert response.json()["profile"]["onboarding"]["step"] == 2
    assert store.docs["learners/a/enrollments/CRS-AC-ECE"]["semester"] == 6
    for body in [{"courseId": "other", "semester": 5}, {"courseId": "CRS-AC-ECE", "semester": 9}]:
        assert (
            client.post("/learners/me/enrollments", headers=headers(), json=body).status_code == 422
        )


def test_corrupt_owned_record_is_not_silently_reset_or_exposed(harness):
    client, store, _ = harness
    bootstrap(client)
    store.docs["learners/a"]["id"] = "wrong-owner"
    response = client.post("/learners/me/bootstrap", headers=headers())
    assert response.status_code == 503
    assert "wrong-owner" not in response.text
    assert store.docs["learners/a"]["id"] == "wrong-owner"


def test_unavailable_firestore_is_not_replaced_with_a_sample_profile(harness, monkeypatch):
    client, _, factory = harness
    services = factory.return_value
    monkeypatch.setattr(
        services.profiles, "bootstrap", Mock(side_effect=RuntimeError("private-secret"))
    )
    response = client.post("/learners/me/bootstrap", headers=headers())
    assert response.status_code == 503
    assert "private-secret" not in response.text


def test_exact_cors_and_profile_openapi(harness):
    client, _, _ = harness
    for origin, allowed in [("http://127.0.0.1:5174", True), ("https://untrusted.example", False)]:
        response = client.options(
            "/learners/me/profile",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        assert (response.headers.get("access-control-allow-origin") == origin) is allowed
    schema = client.get("/openapi.json").json()
    assert "HTTPBearer" in schema["components"]["securitySchemes"]
    assert set(schema["components"]["schemas"]["Preferences"]["properties"]) == {
        "supportLanguage",
        "studyField",
        "dialLevel",
        "onboarding",
    }


def test_real_adapter_uses_firebase_signature_and_revocation_verification(monkeypatch):
    verify = Mock(
        return_value={
            "uid": "verified-owner",
            "name": "Student",
            "firebase": {"sign_in_provider": "google.com"},
        }
    )
    monkeypatch.setattr("kiki_api.backend.auth.verify_id_token", verify)
    app = object()
    assert FirebaseVerifier(app).verify("synthetic-test-token").uid == "verified-owner"
    verify.assert_called_once_with("synthetic-test-token", app=app, check_revoked=True)
    verify.return_value = {"uid": "other", "firebase": {"sign_in_provider": "password"}}
    with pytest.raises(BoundaryError) as error:
        FirebaseVerifier(app).verify("synthetic-test-token")
    assert error.value.status == 403


def test_cloud_configuration_rejects_emulator_or_wildcard_cors(monkeypatch):
    monkeypatch.setenv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, firebase_project_id="test-project")
    monkeypatch.delenv("FIREBASE_AUTH_EMULATOR_HOST")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, firebase_project_id="test-project", cors_origins=["*"])


def test_language_and_field_preferences_are_generic_and_preserve_existing_records(harness):
    client, store, _ = harness
    bootstrap(client)
    store.docs["learners/a"]["futureLearningEvidence"] = {"keep": True}
    body = preferences(3, True)
    body.update(supportLanguage="hi", studyField="CSE")
    body["onboarding"]["fluencySelfRatings"]["support"]["language"] = "hi"
    response = client.patch("/learners/me/profile", headers=headers(), json=body)
    assert response.status_code == 200
    assert response.json()["profile"]["supportLanguage"] == "hi"
    assert response.json()["profile"]["studyField"] == "CSE"
    assert store.docs["learners/a"]["futureLearningEvidence"] == {"keep": True}
    # An older client saving the support dial must not clear the new field.
    body.pop("studyField")
    body["dialLevel"] = 4
    assert (
        client.patch("/learners/me/profile", headers=headers(), json=body).json()["profile"][
            "studyField"
        ]
        == "CSE"
    )
    # A language/field outside the demo catalog is still a valid account preference.
    body.update(supportLanguage="My regional language", studyField="Environmental Studies")
    body["onboarding"]["fluencySelfRatings"]["support"]["language"] = "My regional language"
    assert client.patch("/learners/me/profile", headers=headers(), json=body).status_code == 200
    fetched = client.get("/learners/me/profile", headers=headers()).json()["profile"]
    assert fetched["studyField"] == "Environmental Studies"
    assert fetched["courseIds"] == []
    body["supportLanguage"] = " "
    assert client.patch("/learners/me/profile", headers=headers(), json=body).status_code == 422
