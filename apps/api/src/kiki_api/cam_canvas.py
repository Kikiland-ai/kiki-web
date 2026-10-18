"""One data contract for the ten preserved CAM models and their explicit controls."""

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from .cam_types import SceneReview, SceneSource, SourceBinding


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


POLICIES = json.loads(
    (Path(__file__).resolve().parents[4] / "data-model/media/cam-contract/policies.json").read_text(
        encoding="utf-8"
    )
)
CONFORMANCE = json.loads(
    (
        Path(__file__).resolve().parents[4] / "data-model/media/cam-contract/conformance.json"
    ).read_text(encoding="utf-8")
)


class CanvasControl(StrictModel):
    name: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9]*$")
    label: str = Field(min_length=1)
    min: float
    max: float
    step: float = Field(gt=0)
    default: float
    unit: Literal["", "normalized", "Hz", "degree"]


class VisualBrief(StrictModel):
    kind: Literal["waveform", "block", "graph", "table"]
    description: str
    alt: str
    source: SceneSource = Field(alias="from")


class SavedSceneReview(SceneReview):
    sourceGrounding: Literal["authored_concept"]


class CanvasScene(StrictModel):
    schema_: Literal["cam-interactive-scene/v1"] = Field(alias="schema")
    modelVersion: Literal["cam-packets/3"]
    conceptId: str = Field(pattern=r"^C-AM-(0[1-9]|10)$")
    kind: Literal[
        "signal",
        "flow",
        "am",
        "dsb",
        "spectrum",
        "receiver",
        "filter",
        "phase_recovery",
        "fm",
        "pm",
    ]
    title: str
    controls: list[CanvasControl] = Field(min_length=1, max_length=3)
    visualBrief: VisualBrief
    walkthrough: list[dict[str, str]]
    sourceInteractive: dict[str, JsonValue]
    assumptions: list[str]
    review: SavedSceneReview
    image: dict[str, str]

    @model_validator(mode="after")
    def pinned_model_policy(self):
        expected = POLICIES["concepts"][self.conceptId]
        if (
            self.kind != expected["kind"]
            or [c.model_dump() for c in self.controls] != expected["controls"]
        ):
            raise ValueError("Scene kind or control domain differs from the pinned CAM model")
        return self


class TraceSamples(StrictModel):
    label: str
    values: list[float] = Field(min_length=6, max_length=6)


class CanvasBehaviorCase(StrictModel):
    inputs: dict[str, float]
    cursor: Literal[0.25]
    readouts: list[list[str]]
    samples: list[TraceSamples]
    hasExtraSvg: bool


class ConceptCanvasArtifact(StrictModel):
    artifactId: str = Field(pattern=r"^SCENE-AM-(0[1-9]|10)-canvas$")
    renderer: Literal["cam-concept-canvas/v1"]
    placardIds: list[str] = Field(min_length=1, max_length=4)
    scene: CanvasScene
    sources: list[SceneSource]
    bindings: list[SourceBinding] = Field(min_length=2, max_length=2)
    modelBindings: list[SourceBinding] = Field(min_length=2, max_length=2)
    behaviorTests: list[CanvasBehaviorCase] = Field(min_length=3, max_length=7)
    claim: Literal["ideal_teaching_model"]
    review: SceneReview

    @model_validator(mode="after")
    def complete_model_binding(self):
        if self.artifactId != self.scene.conceptId.replace("C-", "SCENE-") + "-canvas":
            raise ValueError("Artifact identity differs from its scene concept")
        if len(set(self.placardIds)) != len(self.placardIds):
            raise ValueError("Scene slots must be unique")
        if [c.model_dump() for c in self.behaviorTests] != CONFORMANCE[self.scene.conceptId]:
            raise ValueError("Behavior cases differ from the pinned model conformance record")
        pinned = json.loads(
            (
                Path(__file__).resolve().parents[4] / "data-model/media/cam-contract/scenes.json"
            ).read_text(encoding="utf-8")
        )[self.scene.conceptId]
        if self.scene.model_dump(by_alias=True) != pinned["scene"] or not any(
            b.path.endswith("/scene.json") and b.sha256 == pinned["sha256"]
            for b in self.modelBindings
        ):
            raise ValueError("Artifact must bind its exact saved scene bytes")
        if [b.model_dump() for b in self.bindings] != pinned["bindings"] or [
            b.model_dump() for b in self.modelBindings
        ] != pinned["modelBindings"]:
            raise ValueError("Source/model bindings differ from the saved candidate")
        if [s.model_dump(exclude_none=True) for s in self.sources] != [
            self.scene.visualBrief.source.model_dump(exclude_none=True)
        ] or self.review.scientific != self.scene.review.scientific:
            raise ValueError("Canvas sources/review differ from the saved scene")
        if not any(
            b.path.endswith("/models.js") and b.sha256 == POLICIES["modelsSha256"]
            for b in self.modelBindings
        ):
            raise ValueError("Artifact must bind the shared, pinned CAM model code")
        return self
