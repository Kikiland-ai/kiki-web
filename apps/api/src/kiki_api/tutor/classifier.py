"""Label a student reply against the current node's allowed set. One model call; never decides.

Any failure (timeout, quota, malformed output, a label outside the set) becomes `unclear`,
which the engine turns into the next hint rung. The student is never stuck on an error.
"""

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

from .content import TutorQuestion
from .engine import allowed_labels
from .session import OFF_TOPIC, UNCLEAR, Reply, TutorState

if TYPE_CHECKING:
    from .keys import KeyPool

logger = logging.getLogger("kiki_api.tutor")
PROMPT_VERSION = "classify.v1"
PROMPT = (Path(__file__).parent / "prompts" / f"{PROMPT_VERSION}.md").read_text(encoding="utf-8")


@dataclass
class Labelled:
    reply: Reply
    model_ms: int
    error: str | None = None


class Classifier(Protocol):
    def classify(self, q: TutorQuestion, state: TutorState, text: str, mode: str) -> Labelled: ...


def build_prompt(q: TutorQuestion, state: TutorState, text: str) -> tuple[str, list[str]]:
    node = q.stages[state.stageIndex].nodes[state.node]
    labels = allowed_labels(q, state)
    lines = [f"- `{b.id}`: {b.desc}" for b in node.branches()]
    terms = ", ".join(
        sorted({t.term for t in q.terms} | {a for t in q.terms for a in t.alsoAccept})
    )
    prompt = PROMPT.format(
        question=node.line.say.en,
        goal=node.goal,
        labels="\n".join(lines),
        terms=terms or "(none)",
        reply=text.strip()[:2000],
    )
    return prompt, labels


def response_schema(labels: list[str]) -> dict:
    return {
        "type": "OBJECT",
        "properties": {
            "label": {"type": "STRING", "enum": labels},
            "quote": {"type": "STRING"},
            "confidence": {"type": "NUMBER"},
            "termsUsed": {"type": "ARRAY", "items": {"type": "STRING"}},
            "clarity": {"type": "INTEGER", "minimum": -1, "maximum": 2},
        },
        "required": ["label", "quote", "confidence", "termsUsed", "clarity"],
        "propertyOrdering": ["label", "quote", "confidence", "termsUsed", "clarity"],
    }


def parse(raw: str | None, labels: list[str], text: str, mode: str) -> Reply:
    data = json.loads(raw or "")
    label = data.get("label")
    if label not in labels:
        raise ValueError("label outside the allowed set")
    clarity = data.get("clarity")
    clarity = clarity if clarity in (0, 1, 2) else None
    quote = (data.get("quote") or "").strip()[:400] or None
    conf = float(data.get("confidence", 0))
    return Reply(
        mode=mode,
        text=text,
        label=label,
        confidence=min(max(conf, 0.0), 1.0),
        quote=None if label == OFF_TOPIC else quote,
        termsUsed=[str(t)[:60] for t in (data.get("termsUsed") or [])][:12],
        clarity=clarity,
    )


class GeminiClassifier:
    def __init__(
        self,
        keys: "KeyPool | str",
        model: str,
        timeout_ms: int = 12000,
        thinking: str | None = "minimal",
        retries_on_429: int = 0,
        retry_sleep_s: float = 1.5,
    ):
        from .keys import Clients, KeyPool

        self.model, self.thinking, self.retries = model, thinking, retries_on_429
        self.retry_sleep_s = retry_sleep_s
        pool = keys if isinstance(keys, KeyPool) else KeyPool.from_config(keys)
        self.clients = Clients(pool, http_options={"timeout": timeout_ms})

    def _config(self, labels):
        from google.genai import types

        cfg = dict(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=response_schema(labels),
            max_output_tokens=400,
        )
        if self.thinking:
            if self.model.startswith("gemini-2.5"):
                cfg["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
            else:
                cfg["thinking_config"] = types.ThinkingConfig(thinking_level=self.thinking)
        return types.GenerateContentConfig(**cfg)

    def classify(self, q, state, text, mode="text") -> Labelled:
        prompt, labels = build_prompt(q, state, text)
        t0 = time.perf_counter()
        try:
            config = self._config(labels)
            for attempt in range(self.retries + 1):
                t0 = time.perf_counter()
                try:
                    # tries each quota pool in turn; a 402/429/401/5xx moves on to the next pool
                    res = self.clients.call(
                        lambda c: c.models.generate_content(
                            model=self.model, contents=prompt, config=config
                        )
                    )
                    break
                except Exception as exc:  # noqa: BLE001
                    # every pool was busy: rate limits and overload (429/500/503/504) are worth one
                    # more pass
                    if (
                        getattr(exc, "code", None) not in (429, 500, 503, 504)
                        or attempt == self.retries
                    ):
                        raise
                    time.sleep(min(30, self.retry_sleep_s * (attempt + 1)))
            ms = int((time.perf_counter() - t0) * 1000)
            return Labelled(parse(res.text, labels, text, mode), ms)
        except Exception as exc:  # noqa: BLE001 - any provider failure degrades to unclear
            ms = int((time.perf_counter() - t0) * 1000)
            logger.warning("Tutor classifier fell back to unclear (%s)", type(exc).__name__)
            return Labelled(
                Reply(mode=mode, text=text, label=UNCLEAR, confidence=0.0), ms, type(exc).__name__
            )


class FakeClassifier:
    """Deterministic stand-in for tests: maps exact texts (or a callable) to labels."""

    def __init__(self, table: dict[str, str] | None = None, default: str = UNCLEAR, **extra):
        self.table, self.default, self.extra = table or {}, default, extra
        self.calls: list[str] = []

    def classify(self, q, state, text, mode="text") -> Labelled:
        self.calls.append(text)
        label = self.table.get(text, self.default)
        if label not in allowed_labels(q, state):
            label = UNCLEAR
        return Labelled(Reply(mode=mode, text=text, label=label, quote=text, **self.extra), 1)
