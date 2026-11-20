"""Record the real engine's views for the web fixture (dev mode and browser tests).

  uv run python scripts/tutor_export_fixture.py ../web/src/fixtures/tutor-recording.json

Walks every state reachable by chip routes and `unclear`, through the real service and
in-memory store, and records each view, its transitions, and a report per finished state.
Free text in the fixture is matched against the routing sets (exact text → label).
"""

import json
import sys
from collections import deque
from pathlib import Path

from kiki_api.tutor.analysis import FakeSummarizer
from kiki_api.tutor.classifier import FakeClassifier
from kiki_api.tutor.service import TutorService, load_questions
from kiki_api.tutor.session import UNCLEAR
from kiki_api.tutor.store import MemoryTutorStore

QDIR = Path(__file__).resolve().parents[3] / "data-model/tutor/questions"


def key_of(view):
    board = ",".join(i["id"] for i in view["board"])
    return f"{view['node']}|{view['hintLevel']}|{board}|{view['status']}"


def record(qid: str, lang: str, exact_paths: bool) -> dict:
    questions = load_questions()
    store = MemoryTutorStore()
    svc = TutorService(
        questions,
        FakeClassifier({}),
        store,
        FakeSummarizer(
            "Sample summary (fixture): the report above is computed from your own answers."
        ),
        concept_titles=None,
    )
    items: dict[str, dict] = {}
    views: dict[str, dict] = {}
    edges: dict[str, dict[str, str]] = {}
    reports: dict[str, dict] = {}

    def slim(view):
        for it in view["board"]:
            items[it["id"]] = it
        v = {k: val for k, val in view.items() if k not in ("board", "sessionId")}
        v["boardIds"] = [i["id"] for i in view["board"]]
        return v

    counter = [0]

    def advance(sid, label):
        """Fork the session (copy its store entry) and take one turn on the fork."""
        counter[0] += 1
        n = counter[0]
        fork = f"{sid}-{n}"
        src = store.sessions[("fx", sid)]
        store.sessions[("fx", fork)] = {
            "state": src["state"].model_copy(deep=True),
            "events": list(src["events"]),
            "turns": {},
            "last": src["last"],
        }
        if label == UNCLEAR:  # free text the fake classifier cannot place → next hint rung
            return fork, svc.turn("fx", fork, f"k{n:08d}", "(not sure)", None, "text")
        return fork, svc.turn("fx", fork, f"k{n:08d}", None, label, "text")

    def report_of(sid):
        rep = svc.report("fx", sid)
        rep.pop("board", None)
        return rep

    first = svc.start("fx", qid, lang, f"fixture-{qid}-{lang}")
    sid0 = first["sessionId"]
    k0 = key_of(first)
    views[k0] = slim(first)
    queue = deque([(sid0, first)])
    while queue:
        sid, view = queue.popleft()
        k = key_of(view)
        if view["done"]:
            reports.setdefault(k, report_of(sid))  # fallback when the label path was not recorded
            continue
        labels = [c["route"] for c in view["chips"]]
        if UNCLEAR not in labels:
            labels.append(UNCLEAR)
        for label in labels:
            fork, nxt = advance(sid, label)
            nk = key_of(nxt)
            edges.setdefault(k, {})[label] = nk
            if nk not in views:
                views[nk] = slim(nxt)
                queue.append((fork, nxt))

    # exact reports for every chip-only answer path (the analysis depends on the path, not the
    # board)
    by_path: dict[str, dict] = {}
    stack = [(sid0, first, [])] if exact_paths else []
    while stack:
        sid, view, path = stack.pop()
        if view["done"]:
            by_path[">".join(path)] = report_of(sid)
            continue
        for label in [c["route"] for c in view["chips"] if c["route"] != UNCLEAR]:
            fork, nxt = advance(sid, label)
            stack.append((fork, nxt, path + [label]))
    routing = json.loads((QDIR / f"{qid}.routing.json").read_text(encoding="utf-8"))["replies"]
    text_map = {r["text"]: {"node": r["node"], "label": r["label"]} for r in routing}
    return {
        "questionId": qid,
        "lang": lang,
        "start": k0,
        "items": items,
        "views": views,
        "edges": edges,
        "reports": reports,
        **dedupe(by_path),
        "question": svc.question_view(qid),
        "text": text_map,
    }


def dedupe(by_path: dict[str, dict]) -> dict:
    """Store each distinct report once; paths point at it by index."""
    distinct: list[dict] = []
    index: dict[str, int] = {}
    seen: dict[str, int] = {}
    for path, rep in by_path.items():
        blob = json.dumps(rep, sort_keys=True, ensure_ascii=False)
        if blob not in seen:
            seen[blob] = len(distinct)
            distinct.append(rep)
        index[path] = seen[blob]
    return {"pathReports": distinct, "reportByPath": index}


def main(out: str):
    data = {
        "note": "Recorded from the real Python tutor engine by scripts/tutor_export_fixture.py. "
        "Development and browser tests only.",
        # exact per-path reports for the phase-error question; the hard question keeps
        # state-keyed reports and English only, to keep the fixture small
        "recordings": [
            record("ece-phase-error", "en", True),
            record("ece-phase-error", "or", True),
            record("ece-am-envelope-design", "en", False),
            record("ece-am-envelope-design", "or", False),
        ],
    }
    # ece-dsb-receive-drift is served by the real API only (kept out to hold the fixture near 2 MB)
    Path(out).write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    for r in data["recordings"]:
        print(
            r["questionId"],
            r["lang"],
            "states",
            len(r["views"]),
            "finished",
            len(r["reports"]),
            "chip paths",
            len(r["reportByPath"]),
            "distinct reports",
            len(r["pathReports"]),
        )
    print("bytes", Path(out).stat().st_size)


if __name__ == "__main__":
    main(sys.argv[1])
