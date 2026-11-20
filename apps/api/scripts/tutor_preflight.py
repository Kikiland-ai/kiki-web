"""Tutor preflight: run once with the real key before switching tutor mode on.

  uv run python scripts/tutor_preflight.py --env-file <kiki-backend/.env> [--firestore] [--burst 8]
  (or export KIKI_GEMINI_API_KEYS as a JSON list of {key, quota_pool})

Checks, in order, and exits non-zero if any required check fails:
  config      keys present (never printed), model ids set
  keys        each key's status by index and quota pool (at least one pool must work)
  content     every question validates
  models      classifier supports generateContent; Live model supports bidiGenerateContent
  quota       a burst of parallel classifier calls with no 429 (free tier fails this)
  routing     10 labelled replies across the questions: accuracy and p50/p90 latency
  summary     one report summary call
  voice       mint a locked token, connect to Live, speak a brief, check it was said verbatim
  firestore   (--firestore) create, turn and read a session under learners/preflight-*/ then delete it
"""

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RESULTS: list[tuple[str, bool, str]] = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name:10} {detail}")
    return ok


def main(a) -> int:
    from kiki_api.tutor.keys import load_keys

    clf_model = os.environ.get("KIKI_TUTOR_CLASSIFIER_MODEL", "gemini-3.5-flash-lite")
    live_model = os.environ.get("KIKI_TUTOR_LIVE_MODEL", "gemini-3.8-live")
    try:
        pool = load_keys(a.env_file)
    except SystemExit as exc:
        check("config", False, str(exc))
        return 1
    check("config", True, f"{len(pool)} keys in {len(pool.pools)} quota pools; classifier {clf_model}; live {live_model}")

    from google import genai

    working = []
    for entry in pool.entries:
        try:
            probe = genai.Client(api_key=entry.key)          # keep a reference: a collected client closes itself
            probe.models.generate_content(model=clf_model, contents="ok")
            working.append(entry)
            print(f"      key[{entry.index}] pool {entry.pool}: OK")
        except Exception as exc:  # noqa: BLE001
            print(f"      key[{entry.index}] pool {entry.pool}: HTTP {getattr(exc, 'code', '?')} {str(exc).split('message')[-1][3:70]}")
    if not check("keys", working, f"{len(working)}/{len(pool)} keys working"):
        return 1

    from kiki_api.tutor.analysis import GeminiSummarizer, analyse
    from kiki_api.tutor.classifier import GeminiClassifier
    from kiki_api.tutor.engine import start, state_at, step
    from kiki_api.tutor.service import QUESTIONS_DIR, load_questions

    try:
        questions = load_questions()
        check("content", True, f"{len(questions)} questions valid: {', '.join(sorted(questions))}")
    except Exception as exc:  # noqa: BLE001
        check("content", False, str(exc)[:200])
        return 1

    client = genai.Client(api_key=working[0].key)
    try:
        models = {m.name.replace("models/", ""): set(getattr(m, "supported_actions", []) or []) for m in client.models.list()}
        check("models", "generateContent" in models.get(clf_model, set()) and "bidiGenerateContent" in models.get(live_model, set()),
              f"{clf_model}: {sorted(models.get(clf_model, []))[:2]}; {live_model}: {sorted(models.get(live_model, []))[:1]}")
    except Exception as exc:  # noqa: BLE001
        check("models", False, f"{type(exc).__name__}: {str(exc)[:160]}")

    clf = GeminiClassifier(pool, clf_model, retries_on_429=0)
    phase = questions["ece-phase-error"]

    def one(_):
        return clf.classify(phase, state_at(phase, "calc-60"), "cos 60 is 0.5 so half")

    with ThreadPoolExecutor(a.burst) as executor:
        burst = list(executor.map(one, range(a.burst)))
    errors = [r.error for r in burst if r.error]
    check("quota", not errors, f"{a.burst} parallel calls, errors: {errors or 'none'}"
          + (" — looks like a free-tier or low quota" if any(e == "ClientError" for e in errors) else ""))

    replies = []
    for qid in questions:
        path = QUESTIONS_DIR / f"{qid}.routing.json"
        if path.exists():
            replies += [(qid, r) for r in json.loads(path.read_text(encoding="utf-8"))["replies"][:5]]
    correct, ms = 0, []
    for qid, r in replies:
        out = clf.classify(questions[qid], state_at(questions[qid], r["node"]), r["text"])
        correct += out.reply.label == r["label"]
        if not out.error:
            ms.append(out.model_ms)
    ms.sort()
    p90 = ms[int(0.9 * (len(ms) - 1))] if ms else None
    check("routing", replies and correct / len(replies) >= 0.85 and ms and p90 < 4000,
          f"{correct}/{len(replies)} correct; p50 {int(statistics.median(ms)) if ms else '-'} ms, p90 {p90} ms")

    s = start(phase, "en")
    events = list(s.events)
    for label in ["part-survives", "scaled-by-cos", "half", "vanishes", "clear-explanation"]:
        from kiki_api.tutor.session import Reply

        s = step(phase, s.state, Reply(mode="chip", text="x", label=label))
        events += s.events
    summary = GeminiSummarizer(pool, clf_model).summarise(phase, analyse(phase, events), "en", {})
    check("summary", bool(summary), (summary or "no summary")[:90])

    asyncio.run(voice_check(pool, live_model, clf_model))

    if a.firestore:
        firestore_check(questions)

    failed = [n for n, ok, _ in RESULTS if not ok]
    print("\nRESULT:", "READY — switch KIKI_TUTOR_ENABLED on" if not failed else f"NOT READY — failed: {', '.join(failed)}")
    return 1 if failed else 0


async def voice_check(pool, live_model, clf_model):
    from google import genai
    from google.genai import types

    from kiki_api.tutor.voice import VoiceTokens

    try:
        tok = VoiceTokens(pool, live_model, probe_model=clf_model).mint()
        live = genai.Client(api_key=tok["token"], http_options={"api_version": "v1alpha"})
        say = "At 60 degrees, do you get all of the message back, part of it, or none?"
        t0 = time.perf_counter()
        first_audio, spoken = None, []
        async with live.aio.live.connect(model=live_model, config=types.LiveConnectConfig(response_modalities=["AUDIO"])) as sess:
            await sess.send_client_content(turns=types.Content(role="user", parts=[types.Part(
                text="BRIEF " + json.dumps({"mode": "scripted", "lang": "en", "say": say, "expectsReply": True}))]),
                turn_complete=True)
            async for m in sess.receive():
                if m.data and first_audio is None:
                    first_audio = time.perf_counter()
                sc = m.server_content
                if sc and sc.output_transcription and sc.output_transcription.text:
                    spoken.append(sc.output_transcription.text)
                if sc and sc.turn_complete:
                    break
        said = "".join(spoken).strip()
        ok = first_audio is not None and (not said or said.lower().startswith("at 60"))
        check("voice", ok, f"first audio {int((first_audio - t0) * 1000) if first_audio else '-'} ms; said: {said[:60] or '(no transcript)'}")
    except Exception as exc:  # noqa: BLE001
        check("voice", False, f"{type(exc).__name__}: {str(exc)[:160]}")


def firestore_check(questions):
    """Real Firestore with application default credentials, isolated under a throwaway learner id."""
    try:
        from firebase_admin import firestore, get_app, initialize_app

        project = os.environ["KIKI_FIREBASE_PROJECT_ID"]
        try:
            app = get_app("kiki-preflight")
        except ValueError:
            app = initialize_app(options={"projectId": project}, name="kiki-preflight")
        db = firestore.client(app=app, database_id=os.environ.get("KIKI_FIRESTORE_DATABASE", "(default)"))
        from kiki_api.tutor.classifier import FakeClassifier
        from kiki_api.tutor.service import TutorService
        from kiki_api.tutor.store import FirestoreTutorStore

        uid = f"preflight-{uuid.uuid4().hex[:12]}"
        svc = TutorService(questions, FakeClassifier({"weaker": "part-survives"}), FirestoreTutorStore(db))
        first = svc.start(uid, "ece-phase-error", "en", "preflight-start")
        nxt = svc.turn(uid, first["sessionId"], "preflight-turn", "weaker", None, "text")
        again = svc.turn(uid, first["sessionId"], "preflight-turn", "weaker", None, "text")
        evs = svc.events(uid, first["sessionId"])
        ok = nxt["node"] == "why-cos" and again == nxt and [e.seq for e in evs] == list(range(len(evs)))
        ref = db.collection("learners").document(uid)
        for sub in ref.collection("tutorSessions").stream():
            for coll in ("events", "turns"):
                for d in sub.reference.collection(coll).stream():
                    d.reference.delete()
            sub.reference.delete()
        ref.delete()
        check("firestore", ok, f"session, idempotent turn and {len(evs)} ordered events; cleaned up {uid}")
    except Exception as exc:  # noqa: BLE001
        check("firestore", False, f"{type(exc).__name__}: {str(exc)[:160]}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--firestore", action="store_true", help="also round-trip a throwaway session in Firestore (needs ADC)")
    ap.add_argument("--burst", type=int, default=8)
    ap.add_argument("--env-file", help="read GEMINI_API_KEYS from this file (kiki-backend .env format)")
    sys.exit(main(ap.parse_args()))
