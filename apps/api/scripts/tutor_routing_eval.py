"""Routing eval on real Gemini: labelled replies → accuracy, confusions and latency per model.

uv run python scripts/tutor_routing_eval.py <question.json> <routing.json> --models m1,m2 [--runs 1]
Reads GEMINI_API_KEY (or KIKI_GEMINI_API_KEY) from the environment; never prints it.
"""

import argparse
import json
import os
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from kiki_api.tutor.classifier import GeminiClassifier
from kiki_api.tutor.content import TutorQuestion
from kiki_api.tutor.engine import state_at


def pct(values, p):
    s = sorted(values)
    return s[min(len(s) - 1, int(round(p / 100 * (len(s) - 1))))]


def run(model, q, replies, runs, workers, thinking):
    key = os.environ.get("KIKI_GEMINI_API_KEY") or os.environ["GEMINI_API_KEY"]
    clf = GeminiClassifier(key, model, thinking=thinking, retries_on_429=4)

    def one(r):
        state = state_at(q, r["node"], "or" if r["lang"] == "or" else "en")
        return r, clf.classify(q, state, r["text"])

    results = []
    with ThreadPoolExecutor(workers) as pool:
        for _ in range(runs):
            results += list(pool.map(one, replies))
    ok = [res.reply.label == r["label"] for r, res in results]
    ms = [res.model_ms for _, res in results if not res.error]
    errors = [res.error for _, res in results if res.error]
    misses = [
        {"node": r["node"], "lang": r["lang"], "expected": r["label"], "got": res.reply.label,
         "conf": round(res.reply.confidence, 2), "text": r["text"][:90], "error": res.error}
        for r, res in results if res.reply.label != r["label"]
    ]
    return {
        "model": model, "thinking": thinking, "n": len(results), "correct": sum(ok),
        "accuracy": round(sum(ok) / len(results), 3),
        "p50_ms": pct(ms, 50) if ms else None, "p90_ms": pct(ms, 90) if ms else None,
        "mean_ms": int(statistics.mean(ms)) if ms else None, "errors": errors, "misses": misses,
        "terms_sample": [res.reply.termsUsed for r, res in results if r["label"] == "clear-explanation"][:2],
        "clarity_sample": [res.reply.clarity for r, res in results if r["lang"] == "en"][:8],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("question")
    ap.add_argument("routing")
    ap.add_argument("--models", default="gemini-3.5-flash-lite")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--thinking", default="minimal")
    ap.add_argument("--out")
    a = ap.parse_args()
    q = TutorQuestion.model_validate_json(Path(a.question).read_text(encoding="utf-8"))
    replies = json.loads(Path(a.routing).read_text(encoding="utf-8"))["replies"]
    report = [run(m, q, replies, a.runs, a.workers, a.thinking or None) for m in a.models.split(",")]
    for r in report:
        print(f"{r['model']:32} {r['correct']}/{r['n']}  acc {r['accuracy']:.2f}  "
              f"p50 {r['p50_ms']} ms  p90 {r['p90_ms']} ms  errors {len(r['errors'])}")
        for m in r["misses"]:
            print(f"   miss {m['node']:16} {m['lang']:5} want {m['expected']:22} got {m['got']:22} "
                  f"c={m['conf']} {m['error'] or ''} | {m['text']}")
    if a.out:
        Path(a.out).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
