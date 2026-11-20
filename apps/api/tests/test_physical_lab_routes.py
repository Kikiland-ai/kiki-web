"""Auth/relay tests only. Experiment execution remains upstream."""

import hashlib
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient
from test_profiles import TestVerifier, headers

from kiki_api.backend import Services
from kiki_api.concept_media import MemoryMediaAssets
from kiki_api.config import Settings
from kiki_api.lab_narration import MIME, LabNarration, physical_release, storage_prefix
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


def test_narration_requires_owned_session_exact_pack_and_allowlisted_wav(monkeypatch):
    settings = Settings(
        _env_file=None,
        firebase_project_id="unit-test-project",
        lab_execution_mode="local",
        lab_backend_origin="http://127.0.0.1:8100",
        lab_proxy_secret="unit-test-" + "x" * 32,
        physical_labs_enabled=True,
    )
    clip = b"test-only WAV bytes"
    asset_id = hashlib.sha256(clip).hexdigest()
    index = {
        **physical_release(),
        "clips": {"message-wire": {"assetId": asset_id, "bytes": len(clip)}},
    }
    assets = MemoryMediaAssets()
    prefix = storage_prefix(index["revision"], index["experimentId"])
    assets.put(f"{prefix}/assets/{asset_id}.wav", clip, MIME, asset_id)
    session = {
        "session_id": SID,
        "experiment_id": index["experimentId"],
        "pack_version": index["packVersion"],
        "pack_sha256": index["packSha256"],
        "mode": index["mode"],
    }

    def handler(request):
        assert request.url.path == f"/v1/physical-labs/sessions/{SID}"
        return (
            httpx.Response(200, json=session)
            if request.headers["x-kiki-owner"] == "fb:a"
            else httpx.Response(404)
        )

    upstream = LabUpstream(settings, transport=httpx.MockTransport(handler))
    monkeypatch.setattr("kiki_api.physical_lab_routes.LabUpstream", lambda _: upstream)
    services = Services(
        TestVerifier(), Mock(), learning=Mock(), physical_lab_narration=LabNarration(assets, index)
    )
    with TestClient(create_app(settings, lambda: services)) as client:
        root = f"/physical-labs/sessions/{SID}/narration"
        path = f"{root}/{index['revision']}/assets/{asset_id}"
        assert client.get(root).status_code == 401
        assert client.get(root, headers=headers("b")).status_code == 404
        assert client.get(path, headers=headers("b")).status_code == 404
        assert client.get(root, headers=headers()).json() == index
        response = client.get(path, headers=headers())
        assert response.content == clip and response.headers["content-type"] == MIME
        assert response.headers["cache-control"] == "private, no-store"
        assert response.headers["etag"] == f'"{asset_id}"'
        assert client.get(path.replace(asset_id, "0" * 64), headers=headers()).status_code == 404
        assert (
            client.get(path.replace(index["revision"], "0" * 64), headers=headers()).status_code
            == 404
        )
        for field in ("pack_version", "pack_sha256", "mode"):
            expected = session[field]
            session[field] = "different"
            assert client.get(root, headers=headers()).status_code == 404
            assert client.get(path, headers=headers()).status_code == 404
            session[field] = expected
