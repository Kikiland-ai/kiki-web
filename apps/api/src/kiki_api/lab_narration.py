"""Serve a pinned lab narration release from the existing private media bucket."""

import json
from functools import cache
from importlib.resources import files
from typing import Annotated, Literal

from fastapi import Depends, Path, Response
from pydantic import BaseModel, Field

from .backend import BoundaryError
from .lab_preparation import PRACTICAL
from .models import Identity

MIME = "audio/wav"
SHA256 = r"^[a-f0-9]{64}$"
PRIVATE_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


class LabNarrationClip(BaseModel):
    assetId: str = Field(pattern=SHA256)
    bytes: int = Field(gt=0, le=5_000_000)


class LabNarrationIndex(BaseModel):
    schema_: Literal["lab-narration/v1"] = Field(alias="schema")
    experimentId: Literal["PR-AM-DSB"]
    procedureVersion: str = Field(min_length=1, max_length=80)
    profileId: Literal["odia7-english5"]
    revision: str = Field(pattern=SHA256)
    clips: dict[str, LabNarrationClip]


class PhysicalLabNarrationIndex(BaseModel):
    schema_: Literal["physical-lab-narration/v1"] = Field(alias="schema")
    experimentId: Literal["dsb-sc-trainer"]
    packVersion: str = Field(min_length=1, max_length=80)
    packSha256: str = Field(pattern=SHA256)
    mode: Literal["experiment_demo"]
    profileId: Literal["odia7-english5"]
    revision: str = Field(pattern=SHA256)
    clips: dict[str, LabNarrationClip]


@cache
def release():
    return json.loads(files(__package__).joinpath("lab_step_narration.json").read_text("utf-8"))


@cache
def physical_release():
    content = files(__package__).joinpath("physical_lab_step_narration.json").read_bytes()
    return PhysicalLabNarrationIndex.model_validate_json(content).model_dump(by_alias=True)


def storage_prefix(revision, experiment_id=PRACTICAL):
    return f"lab-narration/{experiment_id}/{revision}"


class LabNarration:
    def __init__(self, assets, index=None):
        self.assets = assets
        self.index = release() if index is None else index
        self.by_asset = {clip["assetId"]: clip for clip in self.index["clips"].values()}

    def read(self, revision, asset_id):
        clip = self.by_asset.get(asset_id)
        if revision != self.index["revision"] or clip is None:
            raise BoundaryError(404, "This lab recording was not found.")
        prefix = storage_prefix(revision, self.index["experimentId"])
        return self.assets.read(f"{prefix}/assets/{asset_id}.wav", MIME, clip["bytes"], asset_id)


def wav_response(content, asset_id):
    return Response(content, media_type=MIME, headers={**PRIVATE_HEADERS, "ETag": f'"{asset_id}"'})


def register_lab_narration_routes(app, identity, backend, call):
    user_dep = Annotated[Identity, Depends(identity)]
    root = "/lab-preparations/{prep_id}/narration"

    def authorized(uid, prep_id):
        services = backend()
        preparations = services.lab_preparations
        if preparations is None:
            raise BoundaryError(503, "Lab preparation is unavailable.")
        preparations.learning.access(uid)
        preparation = preparations.record(uid, prep_id)
        if preparation.practicalId != PRACTICAL or services.lab_narration is None:
            raise BoundaryError(404, "Narration is unavailable for this lab.")
        return services.lab_narration

    @app.get(root, response_model=LabNarrationIndex)
    def manifest(prep_id: str, user: user_dep, response: Response):
        index = call(lambda: authorized(user.uid, prep_id).index)
        response.headers.update(PRIVATE_HEADERS)
        return index

    @app.get(
        root + "/{revision}/assets/{asset_id}",
        response_class=Response,
        responses={200: {"content": {MIME: {}}, "description": "Verified lab narration WAV"}},
    )
    def audio(
        prep_id: str,
        user: user_dep,
        revision: str = Path(pattern=SHA256),
        asset_id: str = Path(pattern=SHA256),
    ):
        content = call(lambda: authorized(user.uid, prep_id).read(revision, asset_id))
        return wav_response(content, asset_id)
