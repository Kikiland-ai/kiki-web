"""Allowlisted projection of the existing authored DSB-SC teaching specification."""

from typing import Literal

from pydantic import Field, model_validator

from .models import WireModel


class VisualSource(WireModel):
    origin: str
    label: str
    url: str | None = None


class FrequencyRange(WireModel):
    min: float = Field(gt=0)
    max: float = Field(gt=0)
    step: float = Field(gt=0)


class DsbVisual(WireModel):
    kind: Literal["dsb_sc"]
    schema_: Literal["dsb-sc-visual/v1"] = Field(alias="schema")
    messageFrequencyHz: float = Field(gt=0)
    carrierFrequencyHz: float = Field(gt=0)
    messageRangeHz: FrequencyRange
    sidebandTermId: Literal["T-AM-04-2"]
    carrierTermId: Literal["T-AM-02-2"]
    signalTermId: Literal["T-AM-04-1"]
    sources: list[VisualSource]

    @model_validator(mode="after")
    def valid_frequencies(self):
        r = self.messageRangeHz
        if not r.min <= self.messageFrequencyHz <= r.max < self.carrierFrequencyHz:
            raise ValueError("Message range must be positive and below carrier")
        if r.step > r.max - r.min:
            raise ValueError("Invalid frequency step")
        return self


def project_dsb_visual(source: dict) -> DsbVisual:
    if source["id"] != "C-AM-04":
        raise ValueError("Unsupported visual source")
    interactive = source["explanation"]["modalities"]["interactive"]
    if interactive["kind"] != "parameter_sweep":
        raise ValueError("Unsupported interaction")
    inputs = {item["name"]: item for item in interactive["inputs"]}
    message, carrier = inputs["fm"], inputs["fc"]
    if message["unit"] != "Hz" or carrier["unit"] != "Hz":
        raise ValueError("Expected Hz")
    return DsbVisual(
        kind="dsb_sc",
        schema="dsb-sc-visual/v1",
        messageFrequencyHz=message["default"],
        carrierFrequencyHz=carrier["default"],
        messageRangeHz={k: message[k] for k in ["min", "max", "step"]},
        sidebandTermId="T-AM-04-2",
        carrierTermId="T-AM-02-2",
        signalTermId="T-AM-04-1",
        sources=source["sources"],
    )
