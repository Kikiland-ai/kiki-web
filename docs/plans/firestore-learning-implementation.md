# Firestore learning implementation

Status: Implementation complete; student submission acceptance pending · Updated: 15 October 2026 · BB8 reference-mode engineering implementation

## Objective and success

Make the agreed Analog Modulation journey work for a real Google account: Python reads a versioned Firestore catalog, saves owned lesson positions and grades immutable quiz assignments; the map projects those same results. Reload and a second browser for the same UID must resume the same position/draft. Keep the laptop/phone UI and existing profiles/materials intact.

## Context and scope

Sources: data-model/ledgers/electronics/analog-modulation.json and data-model/cases/analog-modulation-odia.json. Existing web adapters/contracts: apps/web/LEARNING_CONTRACT.md, ASSESSMENT_CONTRACT.md, src/contracts. Existing Python uses Firebase Admin/keyless access and private client rules. Content and Odia remain drafts. User explicitly approved this import/connection; no billing, IAM, deployment, commit or push is included.

## Decisions and constraints

- Import content from original source files; keep them in Git. Exclude case.seeds entirely. Public projections never expose checks/answer keys or synthetic learners.
- Immutable content versions, atomic catalog activation, repeat-safe Python importer with dry-run first. Preserve old content/attempts and unrelated learner fields.
- UID from verified Google token only. Require existing profile/course membership for learning. Python alone saves/grades, with owner-scoped transactions, idempotency and draft revisions.
- Five MCQs/concept, 60%; chapter ten concepts/ten MCQs, 80%. Latest current-version completed checks drive readiness; seven specified checks gate lab. Reading is never a pass.
- Existing Firebase Storage blocker is independent. No paid services, rules changes or private keys.

## Now / Next / Later

1. **Completed:** validated source projection and repeat-safe versioned importer; React schemas checked and 68 authored documents imported/read back from existing Firestore.
2. **Completed implementation; next acceptance:** authenticated content/positions and authoritative assessments/progress, owner/idempotency/version/threshold tests and OpenAPI are in place. Student submits the saved live check to verify result/map with their own answers.
3. **Later:** instructor/Odia review, physical-device resume acceptance, uploaded-source generation and real lab/media integrations.

## Risks and verification

Public answer-key leakage: explicit public DTOs plus pre-submission leak tests. Duplicate attempts/stale drafts: transactional state/operation receipts and revisions. Catalog changes: immutable version snapshots and current-version gating. Large history: preserve all attempt documents; return recent 15 plus active attempts, latest summaries independent of history window. No writes to real scores merely to demonstrate success; synthetic accounts only in tests/emulators. Live reading/position acceptance may use the existing signed-in user without resetting their data.

## Cold pickup

Last completed: imported and read back all 68 catalog documents, implemented Python learning/positions/assessment routes, verified 65 Python / 93 frontend / 52 browser checks and seven actual response contracts. Live Semester 3 enrollment, lesson reload/fresh-sign-in resume and unanswered assignment/cursor saves verified.
Exact next action: student submits the first real concept check, reviews saved result/map and retry, then verifies actual phone/laptop resume.
Cloud/import state: active catalog am-51187527300cba2fa3cca868. No seeds or artificial real-account answers/scores. Existing source JSON retained. See apps/web/active.md and apps/api/LEARNING_STORAGE.md. No billing/IAM/Storage/deploy/Git changes.

## Final verification

65 Python checks, Ruff lint/format, OpenAPI export, 93 frontend checks, 52 Playwright browser checks, frontend lint/TypeScript/production build, seven actual Python→React envelope checks, BB8 package/discovery checks and git diff whitespace checks pass. Production bundles exclude private keys and preview stores. Live API restarted with final checked code and real map/lesson reopened. Screenshot: apps/web/test-results/firestore-learning/lesson-resume.png (ignored). Live quiz remains unanswered/paused at Question 1; real student submit/result and physical-device acceptance remain open.
