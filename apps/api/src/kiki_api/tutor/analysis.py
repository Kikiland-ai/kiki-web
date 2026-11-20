"""Post-session analysis: read the event log, say what to revise and what to strengthen.

Deterministic first (every number traceable to events). A model summary may be added on
top, but it only rephrases this report; it never adds facts.
"""

import json
import logging
import time
from collections import defaultdict

from .content import TutorQuestion
from .session import Event

logger = logging.getLogger("kiki_api.tutor")


def combine(levels: list[str]) -> str:
    levels = [lv for lv in levels if lv in ("ok", "partial", "not_yet")]
    if not levels:
        return "n/a"
    if all(lv == "ok" for lv in levels):
        return "ok"
    if all(lv == "not_yet" for lv in levels):
        return "not_yet"
    return "partial"


def analyse(q: TutorQuestion, events: list[Event]) -> dict:
    metrics = {m.id: m for m in q.metrics}
    stage_of = {nid: s.id for s in q.stages for nid in s.nodes}
    by_metric: dict[str, list[Event]] = defaultdict(list)
    stage = {s.id: {"turns": 0, "hints": 0, "forced": False, "misconceptions": [], "levels": []}
             for s in q.stages}
    fired: list[str] = []
    terms: list[str] = []
    free_turns = 0
    leaks = []

    for e in events:
        sid = e.stage or (stage_of.get(e.node) if e.node else None)
        if e.type == "student_turn" and sid:
            stage[sid]["turns"] += 1
            free_turns += e.mode in ("text", "voice")
        elif e.type == "hint_given" and sid:
            stage[sid]["hints"] += 1
        elif e.type == "speech_leak":
            leaks.append({"node": e.node, "phrase": e.phrase})
        elif e.type == "evidence" and e.metric:
            by_metric[e.metric].append(e)
            if e.basis in ("branch", "forced") and sid:
                stage[sid]["levels"].append(e.level)
                stage[sid]["forced"] |= e.basis == "forced"
                if e.misconception:
                    stage[sid]["misconceptions"].append(e.misconception)
                    fired.append(e.misconception)
            if e.basis == "terms":
                terms += [t for t in (e.termsUsed or []) if t not in terms]

    metric_rows = []
    for m in q.metrics:
        evs = by_metric.get(m.id, [])
        if m.dim == "words":
            if free_turns == 0:
                level = "n/a"
            else:
                share = len(terms) / max(1, len(q.terms))
                level = "ok" if len(terms) >= 3 or share >= 0.5 else "partial" if terms else "not_yet"
        else:
            level = combine([e.level for e in evs])
        metric_rows.append({
            "id": m.id, "dim": m.dim, "level": level,
            "quotes": [e.quote for e in evs if e.quote][:3],
            **({"termsUsed": terms} if m.dim == "words" else {}),
        })
    levels = {r["id"]: r["level"] for r in metric_rows}

    stages = []
    revise: dict[str, str] = {}
    strengthen: dict[str, str] = {}
    catalogue = {mc.id: mc for mc in q.misconceptions}
    for s in q.stages:
        st = stage[s.id]
        level = combine(st["levels"])
        stages.append({"id": s.id, "turns": st["turns"], "hints": st["hints"], "forced": st["forced"],
                       "misconceptions": st["misconceptions"], "level": level})
        for mid in st["misconceptions"]:
            for c in catalogue[mid].conceptIds:
                revise.setdefault(c, f"{mid} in {s.id}")
        if st["forced"]:
            for c in s.conceptIds:
                revise.setdefault(c, f"needed the answer in {s.id}")
        elif level == "partial" or st["hints"] >= 2:
            for c in s.conceptIds:
                strengthen.setdefault(c, f"{st['hints']} hints in {s.id}" if st["hints"] >= 2
                                      else f"partly right in {s.id}")
    for c in revise:
        strengthen.pop(c, None)

    nxt = []
    for step in q.nextSteps:
        if step.whenMisconception and step.whenMisconception not in fired:
            continue
        if step.whenMetric and levels.get(step.whenMetric) != (step.whenLevel or "not_yet"):
            continue
        nxt.append({"kind": step.kind, "id": step.id, "why": step.why.model_dump(by_alias=True, exclude_none=True)})

    completed = any(e.type == "session_completed" for e in events)
    sheet = []
    for e in events:
        if e.type == "item_revealed":
            sheet += [r.item for r in e.items or [] if r.item not in sheet]
    return {
        "questionId": q.id, "completed": completed,
        "metrics": metric_rows,
        "stages": stages,
        "revise": [{"concept": c, "why": w} for c, w in revise.items()],
        "strengthen": [{"concept": c, "why": w} for c, w in strengthen.items()],
        "next": nxt,
        "sheet": sheet,
        "speechLeaks": leaks,
        "turns": sum(s["turns"] for s in stages),
        "hints": sum(s["hints"] for s in stages),
    }


SUMMARY_PROMPT = """You write a short note to an engineering student after a tutoring session.
Use ONLY the facts in the report below. Do not add physics, numbers or advice that is not in it.
Write {sentences} short sentences in {language}: one thing they did well, what to revise (name the
concept titles given), and the next step. Warm and direct. Never say "wrong"; say "not yet".
Keep technical terms in English.

Question: {title}
Concept titles: {concepts}
Report: {report}
"""


class GeminiSummarizer:
    def __init__(self, api_key: str, model: str, timeout_ms: int = 15000):
        from google import genai

        self.model = model
        self.client = genai.Client(api_key=api_key, http_options={"timeout": timeout_ms})

    def summarise(self, q: TutorQuestion, report: dict, lang: str, concept_titles: dict[str, str]) -> str | None:
        from google.genai import types

        slim = {k: report[k] for k in ("metrics", "stages", "revise", "strengthen", "next")}
        for row in slim["metrics"]:
            row.pop("quotes", None)
        prompt = SUMMARY_PROMPT.format(
            sentences=3, language="Odia (technical terms in English)" if lang == "or" else "English",
            title=q.title.en, concepts=json.dumps(concept_titles), report=json.dumps(slim),
        )
        try:
            t0 = time.perf_counter()
            res = self.client.models.generate_content(
                model=self.model, contents=prompt,
                config=types.GenerateContentConfig(temperature=0.3, max_output_tokens=300),
            )
            logger.info("Tutor summary in %d ms", int((time.perf_counter() - t0) * 1000))
            text = (res.text or "").strip()
            return text[:1200] or None
        except Exception as exc:  # noqa: BLE001 - the deterministic report stands on its own
            logger.warning("Tutor summary unavailable (%s)", type(exc).__name__)
            return None


class FakeSummarizer:
    def __init__(self, text: str | None = "Well done."):
        self.text, self.calls = text, 0

    def summarise(self, q, report, lang, concept_titles):
        self.calls += 1
        return self.text
