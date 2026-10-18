"""Pinned scene equality must not depend on the host's text locale."""

import json
from pathlib import Path

import pytest

from kiki_api.cam_canvas import CONFORMANCE, ConceptCanvasArtifact

ROOT = Path(__file__).resolve().parents[3]
SCENES = ROOT / "data-model/media/cam-contract/scenes.json"


@pytest.mark.parametrize("concept_id", ["C-AM-05", "C-AM-06", "C-AM-09", "C-AM-10"])
def test_saved_scene_validates_with_windows_default_decoding(monkeypatch, concept_id):
    pinned = json.loads(SCENES.read_text(encoding="utf-8"))[concept_id]
    original = Path.read_text

    def windows_default(path, encoding=None, errors=None):
        return original(path, encoding=encoding or "cp1252", errors=errors)

    monkeypatch.setattr(Path, "read_text", windows_default)
    artifact = ConceptCanvasArtifact.model_validate(
        {
            "artifactId": concept_id.replace("C-", "SCENE-") + "-canvas",
            "renderer": "cam-concept-canvas/v1",
            "placardIds": [concept_id + "-concept"],
            "scene": pinned["scene"],
            "sources": [pinned["scene"]["visualBrief"]["from"]],
            "bindings": pinned["bindings"],
            "modelBindings": pinned["modelBindings"],
            "behaviorTests": CONFORMANCE[concept_id],
            "claim": "ideal_teaching_model",
            "review": {"scientific": pinned["scene"]["review"]["scientific"]},
        }
    )
    assert artifact.scene.model_dump(by_alias=True) == pinned["scene"]
