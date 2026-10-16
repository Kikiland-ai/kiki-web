# Kiki web: team contract

**v0.3 draft for review · 14 Oct 2026 · Akshita and Arpan (frontend)**

This page fixes the names, routes and data shapes we build against, in the shared `kiki-web` app. The exact shapes are in two files that travel with this page:

- [`src/contracts/api.ts`](../src/contracts/api.ts): data, request and response bodies, endpoints
- [`src/contracts/services.ts`](../src/contracts/services.ts): the functions screens call

If this page and those files disagree, the files win. Changes go in a small separate commit that the others review.

**Sign-off:** Akshita ☐ · Arpan ☐

**Already agreed:** React + TypeScript, Python, Firebase. Google-only sign-in. Colours (green concept, red words, yellow English, blue practical). Thresholds of 3/5 (60%) and 8/10 (80%). Content IDs. The seven lab prerequisites. Student-performed Simulink actions. The `/assessments/:assessmentId/new` handoff.

## What changed from v0.1

| # | Akshita's point | Where it's handled |
|---|---|---|
| 1 | Separate demo scope from the full plan; keep 320–1440px checks | §1, §13 |
| 2 | Lab gate is all seven checks; demo a returning student with six passed | §3 |
| 3 | Align with the existing scaffold | §4, §5, §7. `kiki-web` is the shared app, and the earlier scaffold is a prototype for reference. Its conventions carry over: `PATCH /learners/me/profile`, `{ profile }` wrapping and Button `secondary`. Routes register in `src/app/routes.tsx`. |
| 4 | Complete the lab session contract | §8 |
| 5 | Odia help at every dial level, including 5 | §9 |
| 6 | Deny-all Firestore client rules; backend enforces access | §6 |

## 1. Full application vs demo

The full application plan is unchanged and still the roadmap: `docs/plans/ui-implementation-plan.md` in Design-Thinking, phases 0–9. That includes uploads and Library, Snap and repair, English tasks, hardware labs and release checks.

For the 18 Oct submission we **propose** demoing one path (§3) and building only what it needs first. The other features stay in the roadmap. Postponing them, and every date on this page, is a proposal for us to agree, not a decision.

**Responsive checks stay as in the plan for every screen we build:**
- widths 320, 360, 390, 430, 768, 1024, 1280 and 1440px
- phone landscape and 200% text zoom
- on-screen keyboard open and closed
- long Odia and English text
- touch-only use, with no hover-only or drag-only controls
- no page-level horizontal overflow and no covered actions

Real Android Chrome and iPhone Safari checks are part of the joint review.

## 2. Fixed IDs

Take these from the content files; never invent new ones.

| Thing | ID format | Example |
|---|---|---|
| Learner | Firebase Auth UID, read from the token by the server | |
| Course / chapter | fixed | `CRS-AC-ECE` / `LP-ANALOG-MODULATION` |
| Concepts (10) | `C-AM-01` … `C-AM-10` | `C-AM-08` carrier mismatch |
| Terms (30) | `T-AM-<concept>-<n>` | `T-AM-01-1` amplitude |
| Questions | `Q-AM-<concept>-<n>`; 1–5 concept check, 6 chapter question | `Q-AM-08-3` |
| Concept checks | `AS-AM-01` … `AS-AM-10` (5 questions, pass ≥ 3/5) | `AS-AM-08` |
| Chapter test | `AS-AM-CHAPTER` (10 questions, pass ≥ 8/10) | |
| Practical | `PR-AM-DSB` | |
| Lab checkpoints (12) | `CP-DSB-01` … `CP-DSB-12` | `CP-DSB-11` phase fault |
| Device | random UUID per browser, `localStorage` key `kiki.deviceId` | |
| Dimensions | `concept` · `words` · `english` · `lab` | |

## 3. Demo path

Guided lab execution needs **all seven** required concept checks passed at ≥ 60%: C-AM-01, 02, 03, 04, 06, 07 and 08. The chapter test never gates the lab. Lab preparation (choosing the experiment, reading steps, predicting) is open at any time.

**Proposed demo story:**

1. A returning student signs in with Google. Their account has already passed six concept checks: 01, 02, 03, 04, 06 and 07.
2. The chapter map shows six passed and **C-AM-08 "Carrier mismatch and debugging"** next. It's the last concept on the lab route and sets up the lab's main fault (a 90° receiver phase error), so the lesson leads straight into the experiment.
3. The student studies C-AM-08's four placards, uses the dial and opens a term.
4. They take `AS-AM-08` and score ≥ 3/5. Lab readiness flips to ready.
5. Lab mode → DSB-SC → the 12 checkpoints in Simulink → observations saved.

The returning student's six passes are seeded test data in the demo project. They're created by the backend through its normal scoring path, and the UI never shows them as a real learner's history. Live `C-AM-08` scoring is real.

## 4. Routes and hand-offs

There's one app: **`kiki-web`**, our shared repo (React + TypeScript + Vite). It already has the reconciled tokens, the responsive shell (header with Lab mode, bottom tabs on phone, rail on laptop), placeholder screens for every route below, and the "Fixture mode" banner.

Each feature exports its routes from `src/features/<area>/routes.tsx`, and `src/app/routes.tsx` registers them. Screens from Akshita's earlier prototype can be moved in feature by feature, reusing the shared kit.

| Route | Screen | Owner |
|---|---|---|
| `/` | Welcome | Akshita |
| `/auth`, `/onboarding` | Sign in with Google; language, ratings, dial | Akshita |
| `/home` | Continue learning, Resume lab | Akshita |
| `/chapters/:planId` | 10-concept map/list | Arpan |
| `/concepts/:conceptId` | Four placards, dial, terms, narration | Arpan |
| `/assessments/:assessmentId/new` | Starts a run, then replaces the URL with the run id | Akshita |
| `/assessments/:assessmentId/:runId` | Questions, then result | Akshita |
| `/labs` | Choose or resume DSB-SC | Arpan |
| `/labs/:sessionId` (optionally `?handoff=<id>`) | Tracker, connection, observations | Arpan |
| `/profile` | Dial, sign out | Akshita |
| `/library`, `/practice`, `/hardware/:runId`, `/words` | Roadmap | per plan |

**Hand-offs:**
- Concept "Check this concept" → `/assessments/AS-AM-08/new`.
- Chapter "Chapter test" → `/assessments/AS-AM-CHAPTER/new`.
- Quiz result, if passed → back to `/chapters/LP-ANALOG-MODULATION`. If not, "Revisit" → `/concepts/<first revisitConceptId>`.
- Lab tracker, if not ready → each missing concept's lesson or check.
- Home "Resume lab" → `/labs/<sessionId>` (from `LabApi.getActive`). Home "Continue" → the concept with the latest saved position.

## 5. Shared kit

The kit lives in `src/ui/` (owner: Arpan), and every screen imports from there. Once a component is in use, its names, props and variants stay stable. A rename or removal needs a coordinated change agreed by both of us first.

Components, in the order screens need them:

| Component | Main props | For |
|---|---|---|
| `Button` | `variant: 'primary' \| 'secondary' \| 'text'`, `icon?`, normal button props. Primary is neutral ink. | Everywhere |
| `Sheet` | `open`, `onClose`, `title`. Bottom sheet on phone, side panel on laptop; returns to the same position on close. | Terms, help |
| `StatusBadge` | `label` (always a word), `dimension?`, `tone?: 'neutral' \| 'success' \| 'not_yet'` | Map, quiz, lab |
| `ChoiceOption` | `selected`, `state?: 'idle' \| 'correct' \| 'not_yet'`. Tick or dashed outline, never colour alone. | Quiz |
| `LanguageDial` | `value: 1–5`, `onChange`, `suggested?`. Touch and keyboard. | Onboarding, lessons |
| `Kiki` | `state`, `size`, `lead?: Dimension` | Everywhere |
| `LoadingState`, `ErrorState` | `message`, `onRetry?` | Everywhere |
| `TermChip`, `TermDetails` | Term, pronunciation, meaning; opens a `Sheet` | Lessons |
| `MapNode`, `MasteryRing` | Ring shows "Not assessed" for `null`, never 0% | Map |
| `KikiPointer`, `LabStepper` | Lab only | Lab |

Colours and fonts come from `src/ui/tokens.css` only: white background, Google Sans, Noto Sans Oriya fallback, and the four dimension colours. Pages never define their own colours or fonts.

Already in the repo: `FixtureBanner` and the app shell.

## 6. Data access and security

- The web app uses Firebase **only for Google sign-in**. All data goes through the Python API.
- **Firestore client rules stay deny-all**, as in the current backend repo. The browser never reads or writes Firestore directly.
- The backend enforces everything else:
  - It verifies the Firebase ID token on every call and gets the UID from it, never from the request body.
  - It checks ownership on every record.
  - It treats scores, evidence verdicts, readiness, leases and handoffs as server-written only.
  - It keeps answer keys on the server; public question payloads never include them.
- Firebase Admin bypasses rules, so these checks live in API code and have tests.

## 7. API conventions and endpoints

- **Base URL** includes the version: `VITE_API_BASE_URL=http://127.0.0.1:8000/v1`. Paths below omit `/v1` and match the earlier prototype's, e.g. `PATCH /learners/me/profile`.
- **Response bodies** are wrapped in one named key, following the existing `{ profile: … }`: `{ chapter }`, `{ lesson }`, `{ progress }`, `{ position }`, `{ run }`, `{ result }`, `{ session }`, `{ handoff }`. Services unwrap them for screens.
- **JSON is camelCase.** Pydantic uses snake_case attributes with a camelCase alias generator.
- Every call except `/health` sends `Authorization: Bearer <Firebase ID token>`. Retried POSTs send `Idempotency-Key: <uuid>`.
- **Errors** look like `{ "error": { "code", "message", "requestId?" } }`. The codes are in `ApiErrorCode`. Lab-specific codes are `stale_revision`, `lease_held`, `lease_expired` and `handoff_expired`.
- CORS allows exactly `http://127.0.0.1:5173`, plus any test origin we add explicitly.

| Group | Endpoints |
|---|---|
| Profile | `POST /learners/me/bootstrap` (safe to repeat) · `GET /learners/me/profile` · `PATCH /learners/me/profile` |
| Content | `GET /lesson-plans/{planId}` · `GET /concepts/{conceptId}/lesson` |
| Progress | `GET /learners/me/progress?planId=` (includes lab readiness) · `PUT /learners/me/positions/{conceptId}` |
| Quiz | `POST /assessment-runs` · `GET /assessment-runs/{runId}` · `POST /assessment-runs/{runId}/submit` · `GET /assessment-runs/{runId}/result` |
| Lab | `POST /lab-sessions` · `GET /lab-sessions/active?practicalId=` · `GET /lab-sessions/{id}` · `POST …/take-control` · `…/heartbeat` · `…/release` · `…/handoffs` · `…/connection` · `…/evidence` · `…/observations` · `…/finish` |

**Rules the backend ports to Python unchanged** from `data-model/runtime/learning-case.js`:
- `scoreQuiz`: pass when `correct × 100 ≥ passPercent × total`, never via a rounded percent.
- `requiredConceptReadiness`: the latest concept-check run per required concept.
- `pointerActivation`.
- `transferSession`.

Prove them against the same cases: 2/5, 3/5, 7/10, 8/10, a missing prerequisite, a stale revision and an owner mismatch.

## 8. Lab session contract

**Lifecycle:** `preparing` (checks missing) → `ready` (all seven passed) → `connecting` (software opened) → `active` (Kiki is guiding) ⇄ `paused`. It drops to `disconnected` when sharing stops, the lease is lost or the workspace is wrong, and ends at `completed`. Every state that isn't active shows the reason and a recovery action.

**Pointer activation.** The server computes `session.pointer.active`. It's true only when:
1. the experiment is selected and all seven required checks have passed;
2. Simulink is opened, the workspace is confirmed and observation consent is given;
3. the connection is active;
4. this device holds an unexpired control lease.

The UI shows the live pointer only when `pointer.active` is true. Otherwise it shows `pointer.reasons` in plain words. Opening Lab mode never turns the pointer on by itself.

**Control lease:**
- Only one device controls a session. Every other device is a read-only observer.
- Taking control is an atomic server transaction that checks the UID, `expectedRevision` and the current lease.
- The controlling device calls `heartbeat` every `control.heartbeatSeconds` to renew the lease. The initial trial is 10s heartbeats with a 30s lease; we tune it after the first real run.
- When the lease lapses, the server marks the session `disconnected` and the pointer turns off. The client stops guiding immediately; it never keeps guiding while waiting for a server write.
- A device that loses control shows "Running on another device", the current step and the saved observations, with a "Take control here" button.
- "Take control here" moves control, and the new device must reconnect Simulink and grant capture again.

**Copied session link:**
- `POST …/handoffs` returns `{ handoff: { id, path, savedRevision, expiresAt } }`, with a path like `/labs/<sessionId>?handoff=<id>`.
- The link only locates the session; it grants nothing by itself.
- Opening it requires Google sign-in **as the same account**. A different account gets `forbidden`, an expired link gets `handoff_expired`, and a changed session gets `stale_revision`.
- On success, `take-control` with the `handoffId` moves control and the old device becomes an observer.
- If Simulink was already open, the student saves the model first. The session records `projectSaved`, and Kiki can't recreate an unsaved external model.
- Signing into the same account and pressing Home → Resume lab is the main path. The copied link and a QR code are conveniences built on the same check.

**Reconnection:**
- If sharing stops, the tab closes, the workspace changes or the network drops, the adapter hides the pointer at once and the session goes `disconnected`.
- Verified checkpoints are kept. Reconnecting needs a fresh click: Chrome needs a user gesture, and old screen permission is never reused. Then the workspace is confirmed again, and the lease is renewed or taken.

**Sign-out cleanup.** On sign-out, `AuthService.signOut` runs, in order:
1. every registered cleanup: stop audio, stop capture and the overlay, `release` the lease;
2. unsubscribe listeners and clear private drafts and caches;
3. Firebase sign-out.

A failed release doesn't block sign-out, because the lease expires on its own. Other open tabs stop observing when auth is lost. The UI reminds the student that MathWorks has its own sign-out.

**Evidence:** a student's tick is `student_report`. Only `integration` or `screenshot_review` evidence can be `verified`, and only verified checkpoints fill the blue ring.

## 9. Language dial and term details

**Initial demo implementation.** Each placard has two authored texts, English and Odia (the Odia keeps English terms). The five notches map onto them:

| Notch | Placard text |
|---|---|
| 1 | Odia; term chips also show the Odia meaning inline |
| 2 | Odia with English term chips |
| 3 | Odia and English, one under the other |
| 4 | English with term chips |
| 5 | English |

**At every notch, including 5,** each term chip opens term details with the English spelling, the Odia-script pronunciation and the Odia meaning, plus an example. Separately written intermediate variants replace this mapping when they're authored.

Onboarding's "Which feels easy?" suggests the starting notch: mostly Odia → 2, mixed → 3, mostly English → 4. The student confirms it. Only the student moves the dial.

## 10. Live vs labelled in the demo

| Feature | Demo target | If it isn't ready |
|---|---|---|
| Sign in with Google | Real Firebase project | Emulator with synthetic Google users |
| Lesson text | API, draft content labelled "Draft" | Fixture mode banner |
| Narration | Gemini mixed-language audio, already working in the backend prototype | Recorded or fixture audio, labelled. No sentence highlighting until real alignment exists. |
| Quiz scoring | Server-scored | Fixture scoring, labelled; never in a live build |
| Lab session, lease, phone → laptop | API | Fixture mode banner |
| Kiki pointer in Simulink | Extension (being built by the backend owner) | "Manual guide": written steps, no pointer claim |

## 11. Content version

We need one version for everyone. Akshita, please compare these SHA-256 hashes with your checkout:

| File (in Design-Thinking `data-model/`) | SHA-256 |
|---|---|
| `ledgers/electronics/analog-modulation.json` | `efbd9786f1c3ca1ebaac49a729355baa856042d576b275eb8c1e6828c47e8416` |
| `cases/analog-modulation-odia.json` | `994a730773354e03896d8c6489a12699d85f54a2ee2fd0ef2ee255cc00a74187` |
| `types/learning-case.ts` | `340aeed79711d0f89b2b577e82902cb11bc64f00896159e97b992f3baca35c0c` |
| `runtime/learning-case.js` | `34ed33af89488da00d30ab251217d973f30e7eba6072d80ecc373a3a20086d52` |

If they match, the agreed version should be committed to Design-Thinking so everyone pulls the same files. If they differ, yours wins and we re-check the IDs above.

## 12. Open decisions

| # | Question | Who |
|---|---|---|
| 1 | OK to wrap every response in one named key, like `{ profile }`? | Akshita |
| 2 | C-AM-08 as the demo's seventh concept? | Akshita, Arpan |
| 3 | Which earlier-prototype screens move into `kiki-web` first? | Akshita |
| 4 | Real Firebase project or emulator for sign-in in the demo? | Akshita, Arpan |

## 13. Proposed timeline

All dates are proposals. The frontend doesn't wait on the backend: every screen is built on fixture adapters behind the same service interfaces, and switches to the real API by changing `VITE_APP_MODE`.

| Day | Arpan | Akshita |
|---|---|---|
| 14 Oct | Contract sign-off; kit components (Button, Sheet, StatusBadge, ChoiceOption, LanguageDial, Kiki, Loading/Error) | Clone `kiki-web`; sign-in and onboarding screens; fixture Auth/Learner/Assessment adapters |
| 15 Oct | Fixture Learning/Lab adapters; chapter map + C-AM-08 lesson; term details | Quiz screens on fixtures (3/5 and 8/10 boundaries) |
| 16 Oct | Lab tracker, lease and handoff UI, Manual guide mode | Home (Continue, Resume lab); Profile and sign-out |
| 17 Oct | Joint integration on one laptop; responsive checks; demo rehearsal | same |
| 18 Oct | Fixes only, submit | same |
