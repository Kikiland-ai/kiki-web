# Akshita + Arpan — UI work split and local validation

13 October 2026 · Recommended division; first frontend scaffold now available, backend setup still pending
Parent plan: [UI implementation phases](ui-implementation-plan.md)

Use **one frontend application with feature ownership**, separate feature branches, and one agreed Python API contract. Each person runs the same full stack locally. For joint reviews, merge the completed slices into an integration branch and run that complete application on one laptop. Avoid building two independent UIs that need to be combined at the end.

**React is confirmed.** Build a complete laptop web experience and adapt each feature's layout/interactions to phone screens within the same implementation slice. Arpan owns the responsive primitives; both contributors own laptop functionality and phone adaptation in their feature screens. Use the parent plan's [responsive web contract](ui-implementation-plan.md#responsive-web-contract--laptops-and-phones) as a merge requirement.

## 1. Divide by feature, with one owner for shared files

The following is a proposed allocation; no assumption is made about either person's relative experience. Agree or swap whole features before starting. Owners implement their area; the other person reviews and tests it.

| Area | Primary owner | What to deliver |
|---|---|---|
| App routing, shared service interfaces and integration | **Akshita** | Router/guards, API/Firebase client setup, home navigation, integration checklist |
| Shared design system | **Arpan** | White/Google Sans/Odia tokens, Kiki assets, fields/buttons/sheets/statuses, responsive primitives |
| Sign-in, onboarding and Profile | **Akshita** | Sign in with Google, new/returning profile handling, language/self-ratings/dial confirmation, account switching/sign-out |
| Subjects, upload, processing and Library | **Akshita** | Intake/review/return flows, original-source viewer, job status |
| Chapter map, lessons, terms and media | **Arpan** | Ten-concept map/list, placards, dial/term sheets, audio-clock player, scene/image annotations |
| MCQs, English tasks and progress reports | **Akshita** | Five/ten-question runs, resume/results, word/English task forms, server-backed reports/receipts |
| Written answer and repair | **Akshita**, using Arpan's canvas | Snap/gallery/type flow, transcript confirmation, report, repair and retest |
| Software/hardware lab UI | **Arpan** | Preparation/tracker, connection states, phone/laptop handoff UX, observations, hardware prep/viva |
| Extension/vision/Python backend | **Backend/integration owner — to assign** | Real capture/overlay adapter, APIs, evaluation, evidence/session authority; Arpan owns its UI bridge |
| End-to-end acceptance | **Both** | Cross-review each other's flows and validate a single merged build |

This separates form/data/report work from interactive teaching/lab work. Arpan's media/lab work contains the largest uncertain dependencies; prototype those early with backend support. If it runs longer, Akshita can take hardware forms or the word-deck screen as an explicit whole-feature handover, without changing shared services independently.

**Proposed file ownership:**

```text
Akshita:
  apps/web/src/app/                  # central route registration and guards
  apps/web/src/services/             # agreed API/Auth/read interfaces
  apps/web/src/features/auth/ onboarding/ home/ intake/ library/
  apps/web/src/features/assessment/ progress/ practice/ profile/
Arpan:
  apps/web/src/ui/                   # shared kit/tokens; one source of truth
  apps/web/src/media/                # player, scene, annotations
  apps/web/src/features/learning/ labs/ hardware/
Both, one designated editor per change:
  package/lockfiles, contracts/, fixtures/, configuration, global test setup
```

Arpan exports feature route definitions; Akshita registers them. Both use the same Button, field, LanguageDial, status, source-viewer and canvas interfaces. The UI kit gets one early minimum slice so sign-in/upload screens do not wait for every animation. A shared-file change is raised as a small separate change and reviewed by the other owner before dependent screens use it.

## 2. Agree these contracts together first

1. Token names, component props, route conventions, learner UID and canonical chapter/concept IDs.
2. Python API's versioned OpenAPI/JSON Schema, request/response examples, errors and auth header. Generate the TypeScript API client/types from it. Content JSON stays portable; existing TypeScript types do not run inside Python.
3. Auth checking/signed-out/Google-sign-in/profile/onboarding states, media/job readiness states, and lab controller/connection/revision states.
4. One shared set of synthetic fixtures: fresh learner, partially learned learner, 2/5 and 3/5 concept results, 7/10 and 8/10 chapter results, seven-concept lab readiness, disconnected/active session and uncertain handwriting. Keep answer keys out of public client fixtures used in integrated mode.
5. Service interfaces: `AuthService`, `LearningApi`, authorized asset access and `LabConnectionAdapter`. Feature screens consume these interfaces; they do not invent their own Firestore collections or token handling.

Until an endpoint exists, use a contract-matching fixture adapter behind the same service boundary. Show Fixture mode. Switch that adapter to the real Python API for integration tests; no timer-based pretend completion, and no “test passed” claim from fixtures alone.

## 3. Branch and merge workflow

Recommended branch names are `ui/akshita-account-intake`, `ui/arpan-learning-kit`, then smaller branches such as `ui/concept-checks` and `ui/lab-tracker`. Once the shared foundation is available, each starts from the same reviewed commit. Use `main` as the stable baseline and `ui/integration` for the joint review build.

1. Build a small complete feature slice, including loading/empty/error/return states. Commit only its scoped files.
2. Run its component/contract checks and the frontend build. Open a reviewable change; the other owner checks it.
3. Merge into `ui/integration`, run the joint acceptance checks, and keep the latest passing revision recorded. Synchronize feature branches with that reviewed foundation before starting the next dependent slice.
4. Merge the passing integrated result into `main` through the team's review process. Share the frontend/backend commit hashes, schema version, fixture version and check results.

Avoid editing the same root configuration on both branches. Each person uses their own clone/worktree. Do not create branches or switch this currently dirty checkout until its local work has been preserved. This document proposes the workflow; it does not create a remote, branch or PR.

## 4. Local stack both people use

**Confirmed:** React frontend, Python backend and Firebase Auth/Firestore/Storage. **Recommended:** TypeScript/Vite for React, FastAPI/Pydantic API, pytest for Python and Playwright for complete browser journeys. Use one Python API and a separately started worker where durable jobs need it. Node remains frontend/Firebase CLI tooling, not the backend language. FastAPI exposes OpenAPI for the client contract. [FastAPI reference](https://fastapi.tiangolo.com/tutorial/first-steps/).

Use the same locked dependencies and runtime versions on both machines. The starter suggests Python 3.12/Java 21 for emulators. The actual frontend now locks Firebase 13 and requires Node 24.12+, superseding the initial Node 22 suggestion for web tooling. Check in `.env.example` with placeholders and local defaults; keep credentials and private recordings outside Git.

| Service | Default on the host laptop | Mode |
|---|---|---|
| Web | `http://localhost:5173` | Vite development server |
| Python API | `http://127.0.0.1:8000` | FastAPI; emulator-backed identity/data |
| Auth emulator | `127.0.0.1:9099` | Synthetic Google identities and new/returning sign-in |
| Firestore emulator | `127.0.0.1:8080` | Profiles, jobs, projections, sessions |
| Storage emulator | `127.0.0.1:9199` | Test PDFs/photos/media |
| Emulator UI | `http://127.0.0.1:4000` | Inspect test identities/records/jobs |

Use the synthetic project ID **`demo-kiki-local` everywhere**: web SDK, Python Admin initialization and emulator CLI. Both contributors run separate emulator instances on their own laptop using the same seed version. For one phone-to-laptop test, all clients point to the same host instance so they see the same learner/session.

Proposed local environment contract:

```dotenv
# Web .env.local; public local connection configuration, never Admin credentials
VITE_APP_MODE=local
VITE_FIREBASE_PROJECT_ID=demo-kiki-local
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
VITE_API_BASE_URL=http://127.0.0.1:8000

# Python local environment; names below are supported SDK variables
GCLOUD_PROJECT=demo-kiki-local
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

Web startup calls the Firebase SDK emulator connection functions **before** auth/data operations; Python sets its emulator hosts before Admin initialization. Auth/Firestore host variables omit `http://`. Verify bearer tokens in Python using Firebase Admin; never add a general “skip auth” path. The Auth emulator deliberately accepts test identity behavior that production rejects. [Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore).

**Python storage check:** browser uploads can use the Firebase Storage emulator. Prove upload → Python read → extraction with the exact locked Python storage adapter before declaring the full upload path integrated. The Firebase compatibility table does not promise Python Admin Storage emulator support, and its Python storage module wraps the Google Cloud Storage client. Use an explicitly tested emulator/local object-store adapter if required; do not assume `FIREBASE_STORAGE_EMULATOR_HOST` alone redirects Python reads. A local fixture-file adapter can unblock extraction tests, but label that mode and keep the real upload integration gate open. [Emulator compatibility](https://firebase.google.com/docs/emulator-suite/install_and_configure), [Python storage implementation](https://github.com/firebase/firebase-admin-python/blob/master/firebase_admin/storage.py).

Python CORS allows the exact web development origin and required headers (`Authorization`, content type, idempotency key); add the test HTTPS/LAN origin explicitly when used. A localhost/127.0.0.1 or port change creates a different origin. [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/).

## 5. Repeatable run and check commands

The frontend package, lockfile and lint/typecheck/unit/browser/build scripts now exist in [`apps/web`](../../apps/web/README.md). `npm run dev` deliberately opens a labelled fixture preview; `npm run dev:connected` requires Firebase and Python configuration. The web package requires Node 24.12+ (see its `.nvmrc`). **Python API entry point, backend dependency locks, emulator startup configuration and seed scripts are still pending.** Backend commands below remain a contract to implement, not existing scripts. Keep Firebase configuration in the backend checkout; use absolute config paths or run commands there when the UI lives elsewhere.

**Setup once per reviewed dependency revision:** frontend `npm ci` after its lockfile exists; backend `.venv` plus the agreed locked Python dependency install. Seed one deterministic synthetic snapshot into emulators using a proposed `scripts/seed_local.py`; check emulator hosts/project first and refuse non-local environments. Runtime fixtures use reproducible IDs, explicit versions and current configurable test timestamps, not expired historical handoff dates.

**Start three terminals, after the scaffold exists:**

```sh
# Backend repo; firebase.json points to the agreed test rules/config
firebase emulators:start --project demo-kiki-local --only auth,firestore,storage
```

```sh
# Backend repo; activate .venv and load the local environment first
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```sh
# Frontend repo, apps/web
npm run dev -- --host 127.0.0.1 --port 5173
```

Provide `/health` plus a development-only readiness report for project/mode/schema and connected adapters, without secrets. Wait for readiness, seed, then sign in through the web. If emulators/API are unavailable, show a clear connection error; never silently switch to cloud resources or fixture scores. Emulators support repeatable exported/imported baselines; keep test runs isolated from the manual review instance. [Emulator configuration](https://firebase.google.com/docs/emulator-suite/install_and_configure).

**Before integration merge, proposed checks:**

- Frontend: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Python: `python -m pytest`; include score/handoff parity, authenticated API/ownership, idempotency and storage-adapter tests.
- Contracts: regenerate OpenAPI/client and verify no unexplained diff; validate shared schema fixtures.
- Firebase: client-SDK Firestore/Storage rules tests for cross-user denial and protected writes. Python Admin tests alone cannot prove client rules because Admin bypasses them.
- Joint: `npm run test:e2e` against Python + emulators; publish the exact frontend/backend revisions and result. Agree those script names while scaffolding.
- Responsive: both owners check their screens at 320/360/390/430/768/1024/1280/1440px, phone landscape and 200% text zoom. Include mobile keyboard, safe areas, long Odia, tap alternatives and no page overflow. Run browser-test projects for phone-size and desktop views; real Android/iPhone checks remain part of the joint review.

The original planning task did not install dependencies or run an app. The subsequent first UI slice installs the frontend and validates its labelled preview; backend/emulator and real provider validation are still pending. See [build progress](ui-build-progress.md) for actual results.

## 6. What you validate together

Run one integrated build; Akshita tests Arpan's area and Arpan tests Akshita's. Use a fresh synthetic account plus a returning account. Record Pass/Fail, browser/device, app mode, revision and any fixture substitution.

| Joint check | Expected result |
|---|---|
| Sign in with Google: new and returning users | First-time profile/onboarding; same UID/profile on return; incomplete onboarding resumes; failed bootstrap retries without duplication |
| Google provider and account switching | Emulator checks UI/application behavior with synthetic Google identities; a separate real staging trial proves Google OAuth/redirect, cancellation and account selection |
| Upload → leave → return | Correct durable job, original source/page, recoverable failure; no lost files |
| Concept → dial/term/media → refresh | Correct Odia/English terms and saved position; real timing where tested |
| 2/5 → revisit → 3/5 | Only theory passage changes; no invented English/practical score |
| 7/10 → revisit → 8/10 | Ten chapter questions, correct coverage and saved history |
| Written answer → repair/retest | Actual photo/transcript/annotations or explicit fixture label |
| Phone preparation → laptop Resume lab | Same owner/session and one controller; phone becomes observer |
| Simulink overlay | Actual external tab and fresh target; stop/pause/disconnect hides pointer |
| Other account + shared-device sign-out | Private records denied, listeners/capture/caches cleaned up |
| Resize/rotate during a lesson or quiz | Same route, selected answers and saved position; correct annotation geometry |
| Phone keyboard and long Odia text | Focused fields, errors and primary actions reachable; no clipped text or page overflow |
| Touch-only operation | Dial, map/list, terms, quiz, photo feedback and readings usable without hover or mandatory dragging |

**Real phone testing:** the phone's `localhost` is the phone, not the laptop. For basic same-network tests, point frontend/API/emulator client hosts to the laptop's LAN address and bind only the test services needed for that private-network session. Keep that emulator instance separate from personal data. For microphone, camera and tab-capture checks, use a trusted development HTTPS origin with secure API transport; plain LAN HTTP is not enough. Proxy browser-facing API/emulator traffic through that trusted origin as needed to avoid mixed-content requests. Configure exact CORS and browser trust rather than bypassing certificate warnings. Use desktop Chrome for the initial live Simulink adapter; the phone prepares/observes. [Camera/mic context requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [screen-capture requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia).

Emulators validate local application logic, not real Google OAuth, cloud permissions, mixed-language provider quality or MathWorks access. Finish those with separate staging/real-tool checks from the parent plan. Google is the only account provider; reset, verification-email and phone-OTP flows are outside the application scope. A live lab cannot pass from a Kiki mock simulator.

## 7. First three joint milestones

1. **Shared foundation:** Arpan supplies the minimum responsive UI kit; Akshita wires shell/router/Auth; backend supplies OpenAPI, health, bootstrap and local identity setup. Both can sign in and view the same fixture chapter through a complete laptop layout and its adaptive phone/tablet layouts, with the same saved learning state. Validate these together before splitting into dependent features.
2. **One learning loop:** upload/confirm → one real lesson → five MCQs → saved result → Home continuation. Then expand to ten concepts and the chapter check; repair/media run through the same interfaces.
3. **One practical loop:** seven required checks → phone session → laptop takeover → actual Simulink connection/checkpoints → saved observations → clean sign-out. Run the joint checklist before merging the full journey.

**Exact next action:** review the current frontend with both contributors; freeze the proposed [profile contract](../../apps/web/CONTRACTS.md) and [Arpan handoff](../../apps/web/ARPAN_HANDOFF.md); validate the same locked build on both machines. Arpan can replace learning/lab placeholders while Akshita continues intake/assessment modules. Complete the backend/emulator milestone before claiming real full-stack validation. Backend owner and the real extension source are still to be assigned/provided.
