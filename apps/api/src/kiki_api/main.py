import logging
import threading
from collections.abc import Callable
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request, Security
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .backend import BoundaryError, Services, firebase_services
from .config import Settings
from .document_text import register_text_routes
from .lab_execution_routes import ExecutionBodyLimit, register_lab_execution_routes
from .lab_preparation import register_lab_preparation_routes
from .learning_routes import register_learning_routes
from .material_routes import UploadBodyLimit, register_material_routes
from .models import Enrollment, Identity, Preferences, ProfileEnvelope

logger = logging.getLogger("kiki_api")
bearer = HTTPBearer(auto_error=False)


def create_app(settings: Settings, factory: Callable[[], Services] | None = None) -> FastAPI:
    application = FastAPI(title="Kiki API", version="0.3.0")
    application.add_middleware(UploadBodyLimit)
    application.add_middleware(ExecutionBodyLimit)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "PUT"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )
    lock = threading.Lock()
    services: Services | None = None

    def call(operation):
        try:
            return operation()
        except BoundaryError:
            raise
        except Exception as exc:
            logger.warning("Kiki dependency unavailable (%s)", type(exc).__name__)
            raise BoundaryError(
                503, "The Kiki service is unavailable. Please retry shortly."
            ) from None

    def backend() -> Services:
        nonlocal services
        with lock:
            if services is None:
                services = call(factory if factory else lambda: firebase_services(settings))
        return services

    def identity(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)],
    ) -> Identity:
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise BoundaryError(401, "Sign in with Google to continue.")
        return call(lambda: backend().verifier.verify(credentials.credentials))

    @application.exception_handler(BoundaryError)
    async def boundary_error(_request: Request, exc: BoundaryError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status == 401 else None
        return JSONResponse({"detail": exc.message}, status_code=exc.status, headers=headers)

    @application.exception_handler(RequestValidationError)
    async def bad_input(_request: Request, _exc: RequestValidationError):
        return JSONResponse({"detail": "The request has invalid fields."}, status_code=422)

    @application.exception_handler(Exception)
    async def unavailable(_request: Request, exc: Exception):
        logger.warning("Kiki dependency unavailable (%s)", type(exc).__name__)
        return JSONResponse(
            {"detail": "The Kiki service is unavailable. Please retry shortly."}, status_code=503
        )

    @application.get("/health")
    def health():
        return {"status": "ok", "scope": "profiles", "storage": "firestore"}

    @application.post("/learners/me/bootstrap", response_model=ProfileEnvelope)
    def bootstrap(user: Annotated[Identity, Depends(identity)]):
        return ProfileEnvelope(profile=call(lambda: backend().profiles.bootstrap(user)))

    @application.get("/learners/me/profile", response_model=ProfileEnvelope)
    def read_profile(user: Annotated[Identity, Depends(identity)]):
        return ProfileEnvelope(profile=call(lambda: backend().profiles.get(user.uid)))

    @application.patch("/learners/me/profile", response_model=ProfileEnvelope)
    def update_profile(update: Preferences, user: Annotated[Identity, Depends(identity)]):
        return ProfileEnvelope(profile=call(lambda: backend().profiles.update(user.uid, update)))

    @application.post("/learners/me/enrollments", response_model=ProfileEnvelope)
    def enroll(body: Enrollment, user: Annotated[Identity, Depends(identity)]):
        return ProfileEnvelope(profile=call(lambda: backend().profiles.enroll(user.uid, body)))

    register_text_routes(application, identity, backend, call)
    register_material_routes(application, identity, backend, call)
    register_learning_routes(application, identity, backend, call)
    register_lab_preparation_routes(application, identity, backend, call)
    register_lab_execution_routes(application, identity, backend, call, settings)
    return application


def app() -> FastAPI:
    load_dotenv(".env.local", override=False)
    return create_app(Settings())
