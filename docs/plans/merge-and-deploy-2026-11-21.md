# Merge and deploy handoff: PRs #18 and #19

21 November 2026, Asia/Kolkata. Covers the two open kiki-web pull requests, how to merge them, and what deploying them looks like. Earlier deployment notes: [backend-integration-and-deployment.md](backend-integration-and-deployment.md) (18 October, partly superseded). Tutor switch-on steps in full: [apps/api/TUTOR_RUNBOOK.md](../../apps/api/TUTOR_RUNBOOK.md).

## The answer first

1. **Merge #18, then #19.** They conflict in two files, and both conflicts are additions at the same spot: keep both sides. With both kept, the combined code passes typecheck, lint, 305/305 web tests, the build and 264 API tests.
2. **Deploying #18** is a web-only Firebase Hosting release. **Deploying #19** ships with tutor mode **off**; switching it on is a `kiki-api` revision with one secret and one flag, done when the Gemini billing is in place.
3. **kiki-backend is not involved.** Nothing in kiki-backend or the lab engine (`kiki-lab`) changes.

## The two pull requests

| | #18 Sync C-AM-08 lesson text and scene with narration | #19 Voice tutor mode for Analog Communication |
|---|---|---|
| Author | arpanvihan5-sketch | adityathenerd |
| Scope | Web only: 13 files, +775/−101 | API, web and content: 93 files, about +15.3k |
| What it does | Listen on C-AM-08 steps 2–3 pins the phase scene above the text; the scene and the highlighted sentence follow narration cues; "Explore it yourself" takes over | Staged tutor on decision graphs with a whiteboard, voice through Gemini Live, scorecard and revision sheet; `/talk` hub and entry points; Subjects icon |
| CI | api pass, web pass | api pass, web pass (after `64b1d2a`, which fixed ruff) |
| Behind `main` | 0 commits | 0 commits |
| Reviews | None yet | None yet |
| New dependencies | None | Web: `katex` 0.16.11, `@types/katex`. API: `google-genai` |
| Runtime switch | None (always on) | `KIKI_TUTOR_ENABLED` (default off) |

## Merge order and conflict resolution

**Order: #18 first, then #19.** #18 is small, green and web-only. With it on `main`, #19 shows the two conflicts once, and they are resolved on `feat/tutor-voice`.

```sh
# after #18 is merged into main
git fetch origin
git switch feat/tutor-voice
git merge origin/main          # stops on two conflicts
```

| File | Conflict | Resolution |
|---|---|---|
| `apps/web/src/features/learning/LessonScreen.module.css` | Both add rules at the end of the file. #18: `.readingNow`, `.readingDone`, `.stageSlot`, `.narratedNote`, reduced-motion rule. #19: `.talk`, `.talk > a`, `.talkLabel` | Keep both: #18's narrated block, a blank line, then #19's tutor-entry block. No class names collide |
| `apps/web/active.md` | Both prepend a log entry | Keep both, newest first: #19's entries, `---`, then #18's "Narrated lesson layout" entry. Optionally update #18's "not committed or pushed" line, which is out of date once merged |
| `apps/web/src/features/learning/LessonScreen.tsx` | None. #18 edits the step body; #19 adds an import and a row after the actions | Take the automatic merge |

**After resolving, before pushing:**

```sh
cd apps/web && npx tsc -b && npx eslint . && npx vitest run && npm run build
cd ../api && uv run ruff check && uv run pytest
```

Then one browser check that nobody has done yet: C-AM-08 step 2 with Listen on, confirming #18's sticky stage and #19's "Talk it through with KiKi" row look right together (`npm run dev`, sample student).

Known environment note: `npm ci` warns that the engine wants Node ^24.15 (one machine had 24.13.1). The checks above still passed.

## What deployment looks like

### Pieces and what changes in each

| Piece | #18 | #19 |
|---|---|---|
| Web (Firebase Hosting, `kiki-512012.web.app`) | New build | New build (tutor screens, `/talk`, entry points; KaTeX loads only on tutor pages) |
| API (Cloud Run `kiki-api`) | No change | New image. Tutor code, `data-model/tutor/questions` and the analog ledger copied into the image. Off until switched on |
| Firestore | No change | New data under `learners/{uid}/tutorSessions/{sid}` with `events/` and `turns/`, written only by the API. No new indexes, no rule changes |
| Secret Manager | No change | New secret holding the Gemini key list, needed only to switch tutor mode on |
| Gemini | No change | Classifier and summary (`gemini-3.5-flash-lite`), voice (`gemini-3.8-live`, browser connects with short-lived tokens the API mints) |
| Lab engine (`kiki-lab`), kiki-backend | No change | No change |

### Stage 1: ship both with tutor mode off (safe to do now)

1. Merge as above.
2. Build the API image as usual (`cloudbuild.api.yaml`) and deploy a new `kiki-api` revision with **no new settings**. `/tutor/health` answers `{"enabled": false, ...}`; every other route is unchanged.
3. Build and release the web app as usual. The tutor screens exist, but the entry points only show when the API offers tutor mode, so students see #18's narrated lesson and nothing of the tutor.

Rollback: the previous revision or release, as for any deploy.

### Stage 2: switch tutor mode on (when Gemini billing is ready)

Full commands are in the [runbook](../../apps/api/TUTOR_RUNBOOK.md). In outline:

1. **Preflight on a laptop** with the real keys: `uv run python scripts/tutor_preflight.py --env-file <file with GEMINI_API_KEYS>` until it prints `READY` (key status per pool, models, quota, routing accuracy and latency, summary, a real voice round trip). Add `--firestore` with project credentials to round-trip a throwaway session in the real database.
2. **Secret:** store the key list (`[{"key": ..., "quota_pool": ...}, ...]`, the kiki-backend format) in Secret Manager and give the `kiki-api` runtime service account `secretAccessor` on it.
3. **Tagged revision, no traffic:** deploy with `KIKI_TUTOR_ENABLED=true` and `KIKI_GEMINI_API_KEYS` from the secret, tag `tutor`. Check `https://tutor---<service-host>/tutor/health` shows `enabled: true` with 3 questions and the key and pool counts.
4. **Web preview:** build against that tagged API URL, deploy to a Hosting preview channel, and add the preview origin to `KIKI_CORS_ORIGINS`.
5. **Walkthrough, signed in:** Home → Talk it through → one question by typing and one by voice, in Odia and in English, through to the scorecard.
6. **Promote:** send traffic to the tagged revision; release the web build.

**Rollback:** set `KIKI_TUTOR_ENABLED=false` (tutor answers 503 and the web hides its entry points), or move traffic back to the previous revision. No data migration to undo.

### Before switching on: open items

| Item | Why it matters | Owner |
|---|---|---|
| Gemini billing | Key 0 (pool `gareebi`) is out of prepayment credit. Keys 1–3 work but were intermittently overloaded (503/504) | Team |
| Who deploys | The deploying account needs Cloud Run, Secret Manager and Hosting access on `kiki-512012` (the account on this laptop did not) | Arpan |
| Odia review | All Odia tutor lines and the voice are machine drafts | Odia speaker |
| ECE review | The three questions' physics and grading bands (each question's README has a checklist) | ECE teacher |
| Cold start | The first tutor turn after idle waits for a container; `--min-instances 1` during a demo avoids it (costs money) | Team |

## Verification already done

| Check | Result |
|---|---|
| #18 CI | api and web pass |
| #19 CI | api and web pass (`64b1d2a`) |
| #18 + #19 merged locally, conflicts resolved by keeping both | tsc, eslint, build OK; vitest 305/305; pytest 264 passed, 8 skipped; `uv lock --check` OK |
| #19 live checks (20–21 Nov) | Routing on real Gemini 26/26, 29/29 and 29/32; full voice session through the real screen 7/7 with scorecard; Odia-pinned speech-to-text transcribes Odia in Odia script and routes 7/7 |
| Not done | A browser check with both PRs merged; Firestore against the real project; a deployed walkthrough |
