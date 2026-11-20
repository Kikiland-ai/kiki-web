"""Auth/relay tests only. Experiment execution remains upstream."""

from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient
from test_profiles import TestVerifier, headers

from kiki_api.backend import Services
from kiki_api.config import Settings
from kiki_api.lab_upstream import LabUpstream
from kiki_api.main import create_app

SID = "a" * 32
ORIGIN = "http://127.0.0.1:5174"


@pytest.fixture
def physical(monkeypatch):
    settings = Settings(
        _env_file=None,
        firebase_project_id="unit-test-project",
        lab_execution_mode="local",
        lab_backend_origin="http://127.0.0.1:8100",
        lab_proxy_secret="unit-test-" + "x" * 32,
        physical_labs_enabled=True,
    )
    calls = []
    status = [200]

    def handler(request):
        calls.append(request)
        return httpx.Response(
            status[0], json={"ok": True}, headers={"content-type": "application/json"}
        )

    upstream = LabUpstream(settings, transport=httpx.MockTransport(handler))
    monkeypatch.setattr("kiki_api.physical_lab_routes.LabUpstream", lambda _: upstream)
    learning = Mock()
    services = Services(TestVerifier(), Mock(), learning=learning)
    with TestClient(create_app(settings, lambda: services)) as client:
        yield client, calls, status, learning


def test_requires_identity_and_enrollment(physical):
    client, calls, _, learning = physical
    assert client.get("/physical-labs/sessions").status_code == 401
    assert not calls
    assert client.get("/physical-labs/sessions", headers=headers()).status_code == 200
    learning.access.assert_called_with("a")


def test_fixed_path_owner_and_idempotency_boundary(physical):
    client, calls, status, _ = physical
    status[0] = 201
    response = client.post(
        "/physical-labs/sessions",
        json={"experiment_id": "dsb-sc-trainer", "mode": "experiment_demo"},
        headers={
            **headers(),
            "Origin": ORIGIN,
            "Idempotency-Key": "create-one",
            "x-kiki-owner": "attacker",
            "x-kiki-proxy-key": "forged",
        },
    )
    assert response.status_code == 201
    request = calls[-1]
    assert str(request.url) == "http://127.0.0.1:8100/v1/physical-labs/sessions"
    assert request.headers["x-kiki-owner"] == "fb:a"
    assert request.headers["x-kiki-proxy-key"] != "forged"
    assert request.headers["Idempotency-Key"] == "create-one"
    assert "authorization" not in request.headers
    assert response.headers["cache-control"] == "private, no-store"
    assert client.get("/physical-labs/sessions", headers=headers("b")).status_code == 201
    assert calls[-1].headers["x-kiki-owner"] == "fb:b"


def test_mutations_require_allowed_origin_and_bounded_body(physical):
    client, calls, _, _ = physical
    path = f"/physical-labs/sessions/{SID}/events"
    assert client.post(path, json={}, headers=headers()).status_code == 403
    assert (
        client.post(
            path, json={}, headers={**headers(), "Origin": "https://untrusted.example"}
        ).status_code
        == 403
    )
    assert client.post(path, content="x" * 16001, headers=headers()).status_code == 413
    assert not calls


@pytest.mark.parametrize("suffix", ["", "/pack", "/observations", "/experiment-result", "/receipt"])
def test_session_routes_and_safe_errors(physical, suffix):
    client, calls, status, _ = physical
    path = f"/physical-labs/sessions/{SID}{suffix}"
    assert client.get(path, headers=headers()).status_code == 200
    assert calls[-1].url.path == "/v1" + path
    for upstream, expected in [(409, 409), (404, 404), (500, 503), (302, 503), (401, 503)]:
        status[0] = upstream
        assert client.get(path, headers=headers()).status_code == expected


def test_arbitrary_paths_and_backend_preview_are_not_proxied(physical):
    client, calls, _, _ = physical
    for path in [
        "/physical-labs/preview",
        "/physical-labs/assets/wrong.js",
        "/physical-labs/sessions/not-an-id",
    ]:
        assert client.get(path, headers=headers()).status_code in {404, 422}
    assert not calls


def test_disabled_is_explicit_and_does_not_contact_upstream(physical):
    _, calls, _, _ = physical
    services = Services(TestVerifier(), Mock(), learning=Mock())
    settings = Settings(_env_file=None, firebase_project_id="unit-test-project")
    with TestClient(create_app(settings, lambda: services)) as client:
        assert client.get("/physical-labs/sessions", headers=headers()).status_code == 503
    assert not calls
