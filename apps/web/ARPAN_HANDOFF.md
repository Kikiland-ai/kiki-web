# Connection points for Arpan

Use this **single React app** as the foundation. It now has real package/run/check scripts. Do not build a second app or overwrite Akshita's router/service files from the reference ZIP.

**14 October alignment:** your supplied files are now reconciled locally as `src/contracts/api.ts` and `src/contracts/services.ts`, revision `kiki-web/v0.4-aligned`. Read [the alignment decisions](CONTRACTS.md) before starting. Preserve the existing `profile.ts` shape and auth methods; use `LearnerApi` for profiles and `LearningApi` for teaching. Python sign-off is still pending. Intake and assessment adapters are implemented; learning/lab adapters remain pending.

**14 October intake slice:** Akshita has implemented `features/intake`, `features/library` and the associated `Services.intake` adapters. Use the existing composition root; do not construct a competing Services object without intake. Home/subject entries now lead to real material screens. Fixtures persist originals in browser IndexedDB and explicitly label sample processing. Arpan's lesson/lab adapters remain pending. [Intake contract](INTAKE_CONTRACT.md) documents the required Python endpoints. The small shared `ui/IntakeStatus.tsx` can be incorporated into your eventual status kit without breaking current callers.

| Owner | Files |
|---|---|
| Akshita | `src/app/`, `src/services/`, `features/auth`, `features/onboarding`, `features/home`, `features/profile`, `features/intake`, `features/library`, `features/assessment` |
| Arpan continuing owner | `src/ui/` (small baseline supplied here); new `features/learning`, `features/labs`, `features/hardware`, `src/media/` |
| Coordinate one editor per change | package/lock/config, `src/contracts`, `src/fixtures`, test setup |

The baseline `ui/kit.tsx` exports Button, ActionLink, Card, PageTitle, Alert, Icon, KikiDots, Wordmark, ProgressSteps, Rating and StateScreen. Extend/replace their internals while preserving current callers' props. `ui/styles.css` supplies semantic tokens and responsive primitives. Do not import the legacy HTML runtime or old global `window.Breadboard` bundle.

Shared state: `useSession()` exposes verified identity, validated profile and services. Access private features only through the central `Gate`; their screens do not sign users in independently or invent Firestore collections. New teaching/lab services need approved contracts, with separately labelled fixtures while unavailable. Domain IDs: course `CRS-AC-ECE`, chapter `LP-ANALOG-MODULATION`, practical `PR-AM-DSB`. Concept progression ≥60%, chapter 10 MCQs ≥80%, lab only seven required concept checks. Preview scoring is explicitly development-only; Python must grade connected attempts.

**Assessment connection:** `Services.assessments` is required alongside intake. Link concept completion to `/assessments/AS-AM-xx/new`; link overview/history to `/practice`. Saved runs/results use `/assessments/:assessmentId/:runId`. Use `useAssessmentState()` for current theory status and separate lab prerequisites. Preserve the shared data router in `createAppRouter()`; it supports pause confirmation. See [ASSESSMENT_CONTRACT.md](ASSESSMENT_CONTRACT.md). Local SVG icons now replace font ligatures, preserving the `Icon({ name, className })` API; this fixes phone overflow when external fonts are unavailable.

First deliver a chapter/map and one lesson module. Supply route elements for `/chapters/:planId` and `/concepts/:conceptId`, plus the landing content for `/learn`; Akshita replaces the current explicit FeatureBoundary placeholders in `app/App.tsx`. Later supply `/labs` and `/labs/:sessionId`, and coordinate hardware route registration. Top-right Lab mode already leads to `/labs`; it never starts a pointer.

Do not build mock Simulink activity that claims a real connection. Real Google auth is now configured and popup/reload/sign-out verified; Python profile persistence is pending. The 5173 preview remains deliberately synthetic. The shared cleanup registry is now implemented: register with `services.auth.registerSignOutCleanup(handler)` and use the returned unregister on feature unmount. Stop/hide audio, capture and overlays synchronously before awaiting lease release. Your feature must also clean up on unmount and deactivate on lost observation/controller state; the registry alone does not implement that integration. A server pointer flag cannot override an expired local lease, wrong device or lost capture.

Both run the locked app locally, keep separate feature branches, review small shared-file changes, and test the combined app. Existing documented CLI commands are now implemented in this frontend; backend/emulator scripts are still the Python owner's work. Required responsive widths: 320/360/390/430/768/1024/1280/1440px, landscape and zoom. Preserve one set of state across layout changes.

**Firebase connection preparation:** Akshita has configured the existing real project locally in an ignored file. Preview 5173 remains unchanged; connected review uses 5174. `/connection` exists only in development to separate auth identity from Python profile readiness. No sample data migrates automatically. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md); real provider/domain and Python bootstrap acceptance are tracked in active.md.

**15 October Python profile slice:** `apps/api` now implements the agreed bootstrap/profile/enrollment boundary using Firebase verification and Firestore. Connected UI stays on 5174 with API on 8000. Keep your modules in this same frontend; material/assessment/learning/lab adapters are not made live by the profile step. Read [Firebase setup](FIREBASE_SETUP.md) and [Python OpenAPI](../api/openapi.json). The existing 5173 fixture preview remains separate.

## Library boundary update — 15 October

Private Python upload/list/source/content routes and OpenAPI are ready locally; real originals await Storage setup. Added intake `stored` status (label Saved in Library; OCR/generation pending), cursor list response `nextCursor`, and optional `IntakeApi.listPage`. Arpan lesson/map ownership stays unchanged. A material receipt is not a lesson plan; do not link stored uploads to the case chapter as if extracted. See [current status](active.md) and [setup](../api/STORAGE_SETUP.md).

## Source branch reviewed — 15 October

Pulled https://github.com/Kikiland-ai/kiki-web into the sibling checkout. Latest cumulative source is ui/arpan-a11y / 2256077, reviewed locally on review/arpan-ui. 205 source tests plus lint/typecheck/build pass; map/lesson browser checks at 320–1440px pass. Preview on 5180; current app on 5174 unchanged. [Integration review](../../docs/ux/arpan-map-review.md) identifies session/progress/dial/position, fixture-bundle isolation and older dependency-lock issues. Do not move global synthetic passes into real profiles or overwrite working auth/Library/assessment routes with source placeholders. Combined learning integration is the next implementation slice.

## Combined learning preview implemented — 15 October

Source 2256077 learning screens and needed kit are adapted into this same apps/web. Ported kit is temporarily namespaced ui/learning / --learning-* tokens, keeping current kit.tsx callers and package/lock intact. Existing Gate/session, intake/Library and assessment routes are retained. Preview map uses the current quiz history and UID-owned positions, no six-pass seed. Dial uses saved profile; errors/retry and prerequisite explanations are visible. Review on 5173/learn; 5180 remains the original source comparison. [Integration/provenance](ARPAN_INTEGRATION.md), [Python handoff](LEARNING_CONTRACT.md). Coordinate later shared-kit consolidation and shared-repo publication; no existing auth/profile routes should be overwritten by the reference placeholders.

## 15 October — live learning boundary

Read active.md first: Python/Firestore catalog/lesson/positions and authoritative assessment/progress now replace the missing connected endpoints. Public DTOs pass the existing Zod contracts. No competing profile/progress store was introduced. Keep curated lessons separate from uploaded-source generation and preserve draft labels. Live Semester 3 enrollment/lesson resume and unanswered quiz assignment/cursor are verified; first real student submission remains next. Catalog/import/schema: ../api/LEARNING_STORAGE.md. Your map/lesson ownership is unchanged; do not add the reference fixture learner or old six-pass state to connected accounts.

## 16 October — lab preparation and Aditya boundary

Adapted the lab-selection/readiness/checkpoint flow to current Services/router and Python/Firestore as a preparation-only slice. Global reference stores, extension simulation and completion ticks stay out. New canonical boundary: LAB_PREPARATION_CONTRACT.md. Aditya owns later screen-share monitoring and assessment; no active pointer/trusted evidence claims. Arpan map/lesson/reference checkout is preserved. See active.md for checks and live acceptance.

## Shared repository checkpoint — 16 October

Combined source now follows the kiki-web integration branch layout: one frontend in apps/web, current Python API in apps/api, required content/assets and plans at root. Read ../../TEAM_HANDOFF.md and active.md before continuing. The old root app/fixture stores are superseded; Arpan's original feature ancestry is retained. Coordinate new work against the existing connected services. Aditya's monitoring/assessment stays deferred.
