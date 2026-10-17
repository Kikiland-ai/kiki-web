from typing import Annotated

from fastapi import Depends, Header, Path, Query
from fastapi.responses import Response

from .backend import BoundaryError
from .learning_models import (
    ChapterEnvelope,
    Draft,
    LessonEnvelope,
    OverviewEnvelope,
    PositionEnvelope,
    PositionUpdate,
    ProgressEnvelope,
    ResultEnvelope,
    RunEnvelope,
    Start,
    Submission,
)
from .media_models import MediaManifestEnvelope
from .models import Identity


def register_learning_routes(app, identity, backend, call):
    user_dep = Annotated[Identity, Depends(identity)]
    key_dep = Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=128)]

    def service():
        learning = backend().learning
        if learning is None:
            raise BoundaryError(503, "The learning service is unavailable.")
        return learning

    @app.get(
        "/lesson-plans/{plan_id}", response_model=ChapterEnvelope, response_model_exclude_unset=True
    )
    def chapter(plan_id: str, user: user_dep):
        return {"chapter": call(lambda: service().chapter(user.uid, plan_id))}

    @app.get(
        "/concepts/{concept_id}/lesson",
        response_model=LessonEnvelope,
        response_model_exclude_unset=True,
    )
    def lesson(concept_id: str, user: user_dep):
        return {"lesson": call(lambda: service().lesson(user.uid, concept_id))}

    @app.get(
        "/concepts/{concept_id}/media",
        response_model=MediaManifestEnvelope,
        response_model_exclude_unset=True,
    )
    def media(concept_id: str, user: user_dep):
        return {"manifest": call(lambda: service().media_manifest(user.uid, concept_id))}

    @app.get(
        "/concepts/{concept_id}/media/{media_revision}/assets/{asset_id}",
        response_class=Response,
        responses={200: {"content": {"audio/wav": {}}, "description": "Verified private bytes"}},
    )
    def media_asset(
        concept_id: str,
        user: user_dep,
        media_revision: str = Path(pattern=r"^cm-[a-f0-9]{24}$"),
        asset_id: str = Path(pattern=r"^[a-f0-9]{64}$"),
    ):
        content, meta = call(
            lambda: service().media_asset(user.uid, concept_id, media_revision, asset_id)
        )
        return Response(
            content,
            media_type=meta["mimeType"],
            headers={
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
                "ETag": f'"{asset_id}"',
            },
        )

    @app.get(
        "/learners/me/progress", response_model=ProgressEnvelope, response_model_exclude_unset=True
    )
    def progress(user: user_dep, planId: str = Query(min_length=1, max_length=128)):
        return {"progress": call(lambda: service().progress(user.uid, planId))}

    @app.put(
        "/learners/me/positions/{concept_id}",
        response_model=PositionEnvelope,
        response_model_exclude_unset=True,
    )
    def position(concept_id: str, body: PositionUpdate, user: user_dep):
        return {
            "position": call(lambda: service().save_position(user.uid, concept_id, body.placardId))
        }

    @app.post("/assessment-runs", response_model=RunEnvelope, response_model_exclude_unset=True)
    def start(body: Start, user: user_dep, key: key_dep):
        return {"run": call(lambda: service().start(user.uid, body, key))}

    @app.get(
        "/assessment-runs/{run_id}", response_model=RunEnvelope, response_model_exclude_unset=True
    )
    def get_run(run_id: str, user: user_dep):
        return {"run": call(lambda: service().get_run(user.uid, run_id))}

    @app.put(
        "/assessment-runs/{run_id}/draft",
        response_model=RunEnvelope,
        response_model_exclude_unset=True,
    )
    def draft(run_id: str, body: Draft, user: user_dep, key: key_dep):
        return {"run": call(lambda: service().draft(user.uid, run_id, body, key))}

    @app.post(
        "/assessment-runs/{run_id}/submit",
        response_model=ResultEnvelope,
        response_model_exclude_unset=True,
    )
    def submit(run_id: str, body: Submission, user: user_dep, key: key_dep):
        return {"result": call(lambda: service().submit(user.uid, run_id, body, key))}

    @app.get(
        "/assessment-runs/{run_id}/result",
        response_model=ResultEnvelope,
        response_model_exclude_unset=True,
    )
    def result(run_id: str, user: user_dep):
        return {"result": call(lambda: service().get_result(user.uid, run_id))}

    @app.get(
        "/learners/me/assessment-overview",
        response_model=OverviewEnvelope,
        response_model_exclude_unset=True,
    )
    def overview(user: user_dep, planId: str = Query(min_length=1, max_length=128)):
        return {"overview": call(lambda: service().overview(user.uid, planId))}
