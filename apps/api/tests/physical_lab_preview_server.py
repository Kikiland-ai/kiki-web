"""Isolated local acceptance server. Not imported by the production app.

Uses synthetic identity/records and the real sibling backend engine through ASGI.
No Google, Firestore or model calls. CLI requires an explicit backend checkout.
"""

import argparse
import secrets
import sys
import tempfile
from pathlib import Path

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request

from kiki_api.backend import BoundaryError, Services
from kiki_api.config import Settings
from kiki_api.lab_upstream import LabUpstream
from kiki_api.main import create_app
from kiki_api.models import Identity


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-root", required=True, type=Path)
    args = parser.parse_args()
    sys.path.insert(0, str(args.backend_root.resolve()))
    from prototypes.physical_labs.api import PhysicalBodyLimit, physical_lab_router
    from prototypes.physical_labs.service import PreparationService

    import kiki_api.physical_lab_routes as routes

    class Verifier:
        def verify(self, token):
            if token != "physical-preview":
                raise BoundaryError(401, "Synthetic preview identity required")
            return Identity(uid="preview-student", display_name="Local preview")

    class Access:
        def access(self, uid):
            if uid != "preview-student":
                raise BoundaryError(403, "Synthetic preview only")

    secret = secrets.token_hex(32)
    settings = Settings(
        _env_file=None,
        firebase_project_id="unit-test-project",
        lab_execution_mode="local",
        lab_backend_origin="http://127.0.0.1:8100",
        lab_proxy_secret=secret,
        physical_labs_enabled=True,
        cors_origins=["http://127.0.0.1:5202"],
    )

    def owner(request: Request):
        if not secrets.compare_digest(request.headers.get("x-kiki-proxy-key", ""), secret):
            raise HTTPException(401, "Proxy authentication required")
        return request.headers["x-kiki-owner"]

    def origin(request: Request):
        if request.headers.get("origin") != settings.lab_backend_origin:
            raise HTTPException(403, "Proxy origin required")

    preview_root = Path(__file__).resolve().parents[3] / ".tools"
    preview_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="physical-preview-", dir=preview_root) as directory:
        engine = FastAPI()
        engine.add_middleware(PhysicalBodyLimit)
        engine.include_router(physical_lab_router(PreparationService(directory), owner, origin))
        transport = httpx.ASGITransport(app=engine)
        routes.LabUpstream = lambda _: LabUpstream(settings, transport=transport)
        services = Services(Verifier(), None, learning=Access())
        app = create_app(settings, lambda: services)
        uvicorn.run(app, host="127.0.0.1", port=8092)


if __name__ == "__main__":
    main()
