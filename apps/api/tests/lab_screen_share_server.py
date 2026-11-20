# ruff: noqa: E402
"""Isolated local acceptance with optional read-only hosted narration.

Run with apps/api/.venv Python and KIKI_BACKEND_CHECKOUT pointing to the approved
backend branch. Test verifier/store exist only in this executable, never app startup.
"""

import asyncio
import copy
import json
import os
import secrets
import sys
import tempfile
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BACKEND = Path(os.environ["KIKI_BACKEND_CHECKOUT"]).resolve()
sys.path[:0] = [str(ROOT / "apps/api/tests"), str(BACKEND)]
import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.testclient import TestClient
from google.cloud import storage
from prototypes.backend.app import create_app as upstream_app
from prototypes.json_stream.analysis import JsonStreamingAnalyzer
from prototypes.lab_tracking.procedure import PROCEDURES
from test_learning import Store, transactional
from test_profiles import preferences

from kiki_api import physical_lab_routes
from kiki_api.backend import BoundaryError, FirestoreProfiles, Services
from kiki_api.concept_media import BucketMediaAssets, MemoryMediaAssets
from kiki_api.config import Settings
from kiki_api.lab_execution import LabExecutions
from kiki_api.lab_narration import MIME, LabNarration, physical_release, release, storage_prefix
from kiki_api.lab_preparation import LabPreparations
from kiki_api.lab_upstream import LabUpstream
from kiki_api.learning import FirestoreLearning
from kiki_api.learning_catalog import build_catalog, import_catalog
from kiki_api.main import create_app
from kiki_api.models import Identity

secret = secrets.token_urlsafe(40)
lock = threading.RLock()
physical_audio_dir = os.environ.get("KIKI_PHYSICAL_TEST_NARRATION_DIR")
simulink_audio_dir = os.environ.get("KIKI_LAB_TEST_NARRATION_DIR")
media_bucket = os.environ.get("KIKI_LAB_PREVIEW_MEDIA_BUCKET")
if media_bucket and (physical_audio_dir or simulink_audio_dir):
    raise RuntimeError("Hosted media and on-disk test recordings are mutually exclusive.")
hosted_assets = (
    BucketMediaAssets(storage.Client(project="kiki-512012").bucket(media_bucket))
    if media_bucket
    else None
)
if hosted_assets:
    print(f"Preview narration uses read-only hosted media at gs://{media_bucket}/", flush=True)


def serial(function):
    def apply(transaction):
        with lock:
            return transactional(function)(transaction)

    return apply


# All modules share firebase_admin.firestore, so this patches this test process only.
from firebase_admin import firestore

firestore.transactional = serial


class Verifier:
    revoked = False

    def verify(self, token):
        if self.revoked or token != "isolated-lab-test-token":
            raise BoundaryError(401, "Test sign-in required")
        return Identity(uid="fixture-bikash", display_name="Aditya")


verifier = Verifier()
metrics = {"calls": 0, "mode": "normal", "images": [], "commits": [], "creation_ids": []}


class Chunks(httpx.AsyncByteStream):
    def __init__(self, data):
        self.data = data

    async def __aiter__(self):
        midpoint = len(self.data) // 2
        yield self.data[:midpoint]
        await asyncio.sleep(0.03)
        yield self.data[midpoint:]


async def provider(request):
    # MockTransport never opens a socket. Assert the production analyzer's actual input.
    body = json.loads(request.content)
    parts = body["contents"][0]["parts"]
    cp = json.loads(parts[0]["text"])["checkpoint"]
    pixels = next(p["inlineData"]["data"] for p in parts if "inlineData" in p)
    metrics["calls"] += 1
    metrics["images"] = (metrics["images"] + [pixels])[-3:]
    if metrics["mode"] == "waiting":
        return httpx.Response(429, json={"error": {"message": "Controlled test wait"}})
    value = {
        "criteria": [
            {
                "criterion_id": c["id"],
                "status": "unknown",
                "evidence": "Controlled screen; not assessed.",
            }
            for c in cp["completion_criteria"]
        ],
        "action_findings": [
            {
                "action_id": a["id"],
                "status": "match"
                if metrics["mode"] == "advance_action" and a == PROCEDURES[cp["id"]][0]
                else "unknown",
                "evidence": "Controlled action, ଓଡ଼ିଆ.",
            }
            for a in PROCEDURES[cp["id"]]
        ],
        "uncertainties": [],
    }
    packet = (
        "data: "
        + json.dumps(
            {
                "candidates": [
                    {
                        "content": {"parts": [{"text": json.dumps(value)}]},
                        "finishReason": "STOP",
                    }
                ]
            }
        )
        + "\n\n"
    )
    return httpx.Response(200, stream=Chunks(packet.encode()))


analyzer = JsonStreamingAnalyzer(
    api_key="isolated-test-only", transport=httpx.MockTransport(provider)
)
data = tempfile.TemporaryDirectory(prefix="kiki-python-lab-test-")
upstream = upstream_app(Path(data.name), analyzer=analyzer, proxy_secret=secret)


async def committed(state):
    metrics["commits"].append(state["revision"])


upstream.state.lab.stream_auxiliary_hook = committed

settings = Settings(
    _env_file=None,
    firebase_project_id="isolated-unit-test",
    cors_origins=["http://127.0.0.1:5174"],
    lab_execution_mode="local",
    lab_backend_origin="http://127.0.0.1:8100",
    lab_proxy_secret=secret,
    physical_labs_enabled=bool(physical_audio_dir or hosted_assets),
)
store = Store()
catalog = build_catalog(
    ROOT / "data-model/ledgers/electronics/analog-modulation.json",
    ROOT / "data-model/cases/analog-modulation-odia.json",
)
import_catalog(store, catalog)
profiles = FirestoreProfiles(store)
learning = FirestoreLearning(store, profiles)
preparations = LabPreparations(learning)


class IsolatedUpstream(LabUpstream):
    def __init__(self, config):
        super().__init__(config)
        # Keep the production allowlist exact. Only this isolated executable
        # routes its synthetic upstream to a port separate from the real trial.
        self.origin = "http://127.0.0.1:8102"

    async def request(self, method, path, uid, body=None, operation_key=None):
        result = await super().request(method, path, uid, body, operation_key)
        if method == "POST" and path == "/lab-sessions":
            metrics["creation_ids"].append(json.loads(result[0])["lab_session_id"])
            if metrics["mode"] == "lose_create_response":
                metrics["mode"] = "normal"
                raise BoundaryError(503, "Synthetic lost creation response; reload to recover.")
        return result


executions = LabExecutions(preparations, IsolatedUpstream(settings))
preparations.execution_status = executions.status


def preview_narration(asset_directory, index):
    if hosted_assets is not None:
        return LabNarration(hosted_assets, index)
    if not asset_directory:
        return None
    assets = MemoryMediaAssets()
    for clip in index["clips"].values():
        asset_id = clip["assetId"]
        relative = f"assets/{asset_id}.wav"
        path = f"{storage_prefix(index['revision'], index['experimentId'])}/{relative}"
        assets.put(path, (Path(asset_directory) / relative).read_bytes(), MIME, asset_id)
    return LabNarration(assets, index)


if settings.physical_labs_enabled:
    # This test-only server sends both routes through its isolated upstream.
    physical_lab_routes.LabUpstream = IsolatedUpstream
services = Services(
    verifier,
    profiles,
    learning=learning,
    lab_preparations=preparations,
    lab_executions=executions,
    lab_narration=preview_narration(simulink_audio_dir, release()),
    physical_lab_narration=preview_narration(physical_audio_dir, physical_release()),
)
api = create_app(settings, lambda: services)
headers = {"Authorization": "Bearer isolated-lab-test-token"}
with TestClient(api) as client:
    assert client.post("/learners/me/bootstrap", headers=headers).status_code == 200
    assert (
        client.patch("/learners/me/profile", headers=headers, json=preferences(3, True)).status_code
        == 200
    )
    assert (
        client.post(
            "/learners/me/enrollments",
            headers=headers,
            json={"courseId": "CRS-AC-ECE", "semester": 5},
        ).status_code
        == 200
    )

baseline_docs = copy.deepcopy(store.docs)


@api.post("/__test/reset")
def reset():
    # Isolated in-memory identity/store only; never import this executable in runtime.
    store.docs.clear()
    store.docs.update(copy.deepcopy(baseline_docs))
    metrics.update(calls=0, mode="normal", images=[], commits=[], creation_ids=[])
    verifier.revoked = False
    return {"reset": "synthetic-only"}


@api.get("/__test/status")
def status():
    return {**metrics, "recordPaths": list(store.docs)}


@api.post("/__test/mode/{mode}")
def mode(mode: str):
    if mode not in {"normal", "advance_action", "waiting", "revoked", "lose_create_response"}:
        raise BoundaryError(400, "Unknown test mode")
    metrics["mode"] = mode
    verifier.revoked = mode == "revoked"
    return {"mode": mode}


# A controlled browser tab, never a real MATLAB account or the user's screen.
target = FastAPI()


@target.get("/", response_class=HTMLResponse)
def page():
    control = ""
    if settings.physical_labs_enabled:
        control = (
            '<button id="blank" type="button">Open blank model (preview)</button>'
            '<p id="status" role="status"></p>'
            "<script>document.querySelector('#blank').onclick=async function(){"
            "const response=await fetch('/preview/blank-model',{method:'POST'});"
            "if(response.ok){this.disabled=true;document.querySelector('#status').textContent="
            "'Blank model opened. KiKi will read the next step.'}};</script>"
        )
    return (
        "<!doctype html><title>Kiki target fixture</title><style>"
        "body{background:#e5f5e0;font:24px monospace;padding:40px}main{width:300px}"
        "#pulse{width:80px;height:80px;background:#247a47}</style><main>"
        "<h1>Simulink preview</h1><p>Use this sample tab to listen to the first two steps.</p>"
        f'{control}<div id="pulse"></div></main>'
        '<script>setInterval(()=>document.querySelector("#pulse")'
        ".textContent=String(Date.now()),2100)</script>"
    )


@target.post("/preview/blank-model")
def blank_model():
    if not settings.physical_labs_enabled:
        raise BoundaryError(404, "This control is available only in the combined preview.")
    metrics["mode"] = "advance_action"
    return {"opened": True}


# Reject a dirty port instead of accidentally testing an unrelated local server.
import socket

for port in [8102, 8002, 8871]:
    with socket.socket() as check:
        check.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        check.bind(("127.0.0.1", port))
for app, port in [(upstream, 8102), (target, 8871)]:
    threading.Thread(
        target=lambda a=app, p=port: uvicorn.run(
            a, host="127.0.0.1", port=p, log_level="warning", access_log=False
        ),
        daemon=True,
    ).start()
uvicorn.run(api, host="127.0.0.1", port=8002, log_level="warning", access_log=False)
