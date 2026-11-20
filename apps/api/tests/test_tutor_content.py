"""Tutor content: the real question passes; each seeded defect is caught by schema or validator."""

import json
from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError

from kiki_api.tutor.content import TutorQuestion
from kiki_api.tutor.validate import validate

ROOT = Path(__file__).resolve().parents[3]
QUESTIONS = sorted((ROOT / "data-model/tutor/questions").glob("*.json"))
QUESTIONS = [p for p in QUESTIONS if not p.name.endswith(".routing.json")]
PHASE = ROOT / "data-model/tutor/questions/ece-phase-error.json"


def raw():
    return json.loads(PHASE.read_text(encoding="utf-8"))


def check(data):
    return validate(TutorQuestion.model_validate_json(json.dumps(data)))


@pytest.mark.parametrize("path", QUESTIONS, ids=lambda p: p.stem)
def test_every_question_file_is_valid(path):
    report = validate(TutorQuestion.model_validate_json(path.read_text(encoding="utf-8")))
    assert report.ok, report.errors


def node(d, stage, nid):
    return next(s for s in d["stages"] if s["id"] == stage)["nodes"][nid]


def errors_for(mutate):
    d = raw()
    mutate(d)
    return check(d).errors


def test_unreachable_node():
    def m(d):
        node(d, "predict", "show-part-survives")["next"] = "$exit"
        node(d, "predict", "predict-60")["misconceptions"][1]["next"] = "$exit"
    assert any("unreachable" in e for e in errors_for(m))


def test_cycle():
    def m(d):
        node(d, "predict", "show-phase-matters")["next"] = "predict-60"
    assert any("cycle" in e for e in errors_for(m))


def test_unknown_next():
    def m(d):
        node(d, "mechanism", "show-cos-factor")["next"] = "calc-60"   # other stage
    assert any("not a node in this stage" in e for e in errors_for(m))


def test_answer_on_probe_enter():
    def m(d):
        node(d, "calculate", "calc-60")["line"]["reveal"].append({"item": "cos60", "on": "enter"})
    assert any("shown before earned" in e for e in errors_for(m))


def test_answer_in_an_earlier_stage():
    def m(d):
        node(d, "predict", "show-part-survives")["line"]["reveal"].append({"item": "cos90", "on": "enter"})
    assert any("predict-90" in e and "shown before earned" in e for e in errors_for(m))


def test_answer_from_worked_step_hint():
    def m(d):
        node(d, "mechanism", "why-cos")["hints"][2]["reveal"].append({"item": "gain-out", "on": "enter"})
    assert any("why-cos" in e and "shown before earned" in e for e in errors_for(m))


def test_answer_from_an_ancestor_branch_in_the_same_stage():
    def m(d):
        stage = next(s for s in d["stages"] if s["id"] == "calculate")
        # calc-60 → (angle-unit-mixup) → show-angle-units → new probe; calc-60's branch leaks it
        stage["nodes"]["show-angle-units"]["next"] = "check-again"
        stage["nodes"]["check-again"] = deepcopy(stage["nodes"]["calc-60"])
        stage["nodes"]["check-again"]["answerItems"] = ["result"]
        for b in stage["nodes"]["check-again"]["expect"] + stage["nodes"]["check-again"]["misconceptions"]:
            b["next"] = "$exit"
            b["reveal"] = []
        stage["nodes"]["check-again"]["hints"][3]["reveal"] = [{"item": "result", "on": "enter"}]
        stage["nodes"]["calc-60"]["misconceptions"][0]["reveal"] = ["result"]
    errs = errors_for(m)
    assert any("check-again" in e and "result" in e for e in errs), errs


def test_scripted_line_says_a_forbidden_phrase():
    def m(d):
        node(d, "calculate", "calc-60")["line"]["say"]["en"] = "At 60°, is it half? What fraction comes out?"
    assert any("forbidden 'half'" in e for e in errors_for(m))


def test_chip_route_must_be_a_branch():
    def m(d):
        node(d, "predict", "predict-60")["chips"][0]["route"] = "vanishes"
    assert any("chip routes" in e for e in errors_for(m))


def test_misconception_must_be_catalogued():
    def m(d):
        node(d, "predict", "predict-60")["misconceptions"][0]["id"] = "made-up"
        node(d, "predict", "predict-60")["chips"][0]["route"] = "made-up"
    assert any("not in the catalogue" in e for e in errors_for(m))


def test_first_expect_must_be_ok():
    def m(d):
        node(d, "mechanism", "why-cos")["expect"].reverse()
    assert any("first expect" in e for e in errors_for(m))


def test_unknown_board_item_and_term():
    def m(d):
        node(d, "extend", "show-90")["line"]["reveal"].append({"item": "ghost", "on": "enter"})
        d["board"]["term-x"] = {"id": "term-x", "kind": "term", "termId": "T-NOPE"}
    errs = errors_for(m)
    assert any("ghost" in e for e in errs) and any("T-NOPE" in e for e in errs)


def test_node_ids_unique_across_stages():
    def m(d):
        stage = next(s for s in d["stages"] if s["id"] == "extend")
        stage["nodes"]["calc-60"] = stage["nodes"].pop("show-90")
        stage["nodes"]["predict-90"]["expect"][0]["next"] = "calc-60"
        for b in stage["nodes"]["predict-90"]["misconceptions"]:
            b["next"] = "calc-60"
    assert any("also used in stage" in e for e in errors_for(m))


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: node(d, "predict", "predict-60")["hints"].reverse(),               # rung order
        lambda d: node(d, "predict", "predict-60").pop("expect"),                    # probe w/o expect
        lambda d: node(d, "extend", "show-90").pop("next"),                          # show w/o next
        lambda d: d["board"]["rx"]["params"]["edges"].append({"from": "x", "to": "g"}),
        lambda d: d["board"].update({"sp": {"id": "sp", "kind": "figure", "template": "spectrum",
                                             "caption": {"en": "s"},
                                             "params": {"lines": [{"f": 9, "a": 1}], "fRange": [0, 5]}}}),
        lambda d: d["board"]["traces-60"]["params"].update({"t": [2, 0]}),
        lambda d: d["board"]["q"].update({"id": "other"}),
        lambda d: node(d, "predict", "predict-60")["line"]["reveal"].append({"item": "q", "on": "later"}),
        lambda d: d.update({"extra": 1}),
    ],
    ids=["rungs", "no-expect", "no-next", "edge", "spectrum-range", "t-range", "board-key",
         "anchor", "extra-field"],
)
def test_schema_rejects(mutate):
    d = raw()
    mutate(d)
    with pytest.raises(ValidationError):
        TutorQuestion.model_validate_json(json.dumps(d))
