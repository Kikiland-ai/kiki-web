"""Strict common types from the verified CAM archive."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class SourceBinding(StrictModel):
    path: str = Field(min_length=1)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class SceneSource(StrictModel):
    origin: str
    label: str = Field(min_length=1)
    url: str | None = None


class SceneReview(StrictModel):
    scientific: Literal["pending", "accepted", "rejected"]
