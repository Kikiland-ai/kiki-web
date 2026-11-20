"""Local tutor API for development: the real tutor routes, engine and Gemini calls, on 127.0.0.1.

  cd apps/api
  read -rs KIKI_GEMINI_API_KEY && export KIKI_GEMINI_API_KEY      # paste the key; not echoed
  PYTHONUTF8=1 uv run python scripts/tutor_dev_server.py           # → http://127.0.0.1:8090

Then run the web app with VITE_TUTOR_DEV_API=http://127.0.0.1:8090 (sample mode). Every tutor
request is printed here: the endpoint, status and time, and for each reply the label Gemini chose,
its confidence and the model latency.

Development only, like the web's sample mode: one local learner identity, sessions kept in memory,
bound to localhost. It refuses to run on Cloud Run and is not part of the deployed image's command.
"""

import json
import logging
import os
import sys
import time
from unittest.mock import Mock

if os.environ.get("K_SERVICE") or os.environ.get("KIKI_ENVIRONMENT") == "cloud" and os.environ.get("K_REVISION"):
    sys.exit("tutor_dev_server is for local development only")

from fastapi import Request  # noqa: E402

from kiki_api.backend import Services  # noqa: E402
from kiki_api.config import Settings  # noqa: E402
from kiki_api.main import create_app  # noqa: E402
from kiki_api.models import Identity  # noqa: E402
from kiki_api.tutor.analysis import GeminiSummarizer  # noqa: E402
from kiki_api.tutor.classifier import GeminiClassifier  # noqa: E402
from kiki_api.tutor.service import TutorService, load_questions  # noqa: E402
from kiki_api.tutor.store import MemoryTutorStore  # noqa: E402
from kiki_api.tutor.voice import VoiceTokens  # noqa: E402

PORT = int(os.environ.get("KIKI_TUTOR_DEV_PORT", "8090"))
DEV_TOKEN = "local-dev"


class LocalVerifier:
    """Accepts only the fixed local token; everyone is the same local learner."""

    def verify(self, token: str) -> Identity:
        from kiki_api.backend import BoundaryError

        if token != DEV_TOKEN:
            raise BoundaryError(401, "Local dev server: use the local dev token.")
        return Identity(uid="local-dev-learner", display_name="Local learner")


def main():
    key = (os.environ.get("KIKI_GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip()
    if not key:
        sys.exit("Set KIKI_GEMINI_API_KEY (server-side Gemini key) first")
    clf_model = os.environ.get("KIKI_TUTOR_CLASSIFIER_MODEL", "gemini-3.5-flash-lite")
    live_model = os.environ.get("KIKI_TUTOR_LIVE_MODEL", "gemini-3.8-live")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s", datefmt="%H:%M:%S")
    log = logging.getLogger("tutor-dev")

    tutor = TutorService(load_questions(), GeminiClassifier(key, clf_model, retries_on_429=1), MemoryTutorStore(),
                         GeminiSummarizer(key, clf_model), voice=VoiceTokens(key, live_model))
    services = Services(LocalVerifier(), Mock(), tutor=tutor)
    settings = Settings(_env_file=None, firebase_project_id="local-dev",
                        cors_origins=["http://127.0.0.1:5173", "http://localhost:5173"])
    app = create_app(settings, lambda: services)

    @app.middleware("http")
    async def show(request: Request, call_next):
        body = await request.body()
        t0 = time.perf_counter()
        response = await call_next(request)
        ms = int((time.perf_counter() - t0) * 1000)
        line = f"{request.method} {request.url.path} → {response.status_code} in {ms} ms"
        if request.url.path.endswith("/turns") and body:
            sent = json.loads(body)
            line += f" | sent {sent}"
        log.info(line)
        return response

    real_turn = tutor.turn

    def turn(uid, sid, key_, text, chip, mode):
        view = real_turn(uid, sid, key_, text, chip, mode)
        r = view.get("route") or {}
        source = "chip, no model call" if chip else f"Gemini {clf_model} {view['timing']['modelMs']} ms"
        log.info(f"   ↳ label={r.get('label')} conf={r.get('confidence')} ({source}) → node {view['node']}"
                 f" stage {view['stage']} hint {view['hintLevel']}{' DONE' if view['done'] else ''}")
        return view

    tutor.turn = turn
    from kiki_api.tutor.wiring import STATUS

    STATUS.clear()
    STATUS.update(enabled=True, reason="local dev server", questions=sorted(tutor.questions),
                  classifierModel=clf_model, liveModel=live_model)
    log.info(f"Tutor dev API on http://127.0.0.1:{PORT}  classifier={clf_model} live={live_model} "
             f"questions={sorted(tutor.questions)}")
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")


if __name__ == "__main__":
    main()
