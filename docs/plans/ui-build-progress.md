# Akshita UI implementation — build history

**Current frontend status:** [apps/web/active.md](../../apps/web/active.md). This document preserves the implementation history; update the active record after every completed step.

History updated: 14 October 2026. Current status lives in [apps/web/active.md](../../apps/web/active.md).

**Student review guide:** [what to click in the current UI](../ux/ui-slice-review.md). This document retains earlier verification and decisions. The latest completed slice adds concept/chapter checks; live source processing and backend integration remain pending.

## Objective and success

Start Akshita's allocated React work in one shared frontend, following the [implementation plan](ui-implementation-plan.md), [team allocation](ui-team-local-validation.md) and [agreed journey](../ux/student-journey-odia-ece.md). A student can open Kiki, sign in, resume onboarding, confirm Odia/English support, and reach Home/Profile. Layouts work on laptops and adapt to phones.

## Present state and decisions

There was no frontend package or Python application in this checkout at the start. Existing uncommitted content/planning changes must remain untouched. React, Python, Firebase and Google-only sign-in are confirmed. TypeScript/Vite implements the recommended frontend foundation. The older journey's separate Create account/Login buttons are superseded by the latest Google-only decision. No remote, deployment, commit or cloud project change is part of this task.

BB8, engineering-implementation and experience-design are used as local reference guidance. Inspected: repository instructions, their engineering/product principles, both UI plans, the current student journey, artifact review, learner/case models, design-system guide/dial and Kiki SVGs, and the supplied clickable HTML's styling. Arpan's supplied API/service drafts have since been inspected and reconciled locally. An agreed Python OpenAPI specification, Firebase project configuration and a working guidance extension remain unavailable. Do not treat fixture checks as live integration evidence.

## Current continuation

Read [the active frontend record](../../apps/web/active.md) for Now / Next / Later and the exact pickup point. Earlier verification below remains historical evidence.

## Ownership and dependencies

Akshita owns `src/app`, `src/services`, auth/onboarding/home/profile and subject setup. A small baseline kit in `src/ui` supports this first slice and is explicitly handed to Arpan as its continuing owner. His learning/lab/media implementation remains separate. Python owns profile bootstrap/storage and authoritatively evaluates assessments; the browser never awards scores or lab readiness. Define versioned contracts and labelled fixtures while that API is unavailable.

## Verification and boundaries

Check new/returning fixture navigation, refresh/resumed onboarding, protected deep links, profile-save errors, sign-out, no page overflow across agreed widths, reduced motion and keyboard interaction. Run lint/typecheck/unit/browser tests/build. Live Google OAuth, Python/Firestore ownership, cross-device persistence and native device checks remain separate gates. Fixture mode is development-only and must never silently substitute for failed API/auth connections.

## Actual results for the first slice

- Runnable source and dependency lock in `apps/web`; Chrome preview at http://127.0.0.1:5173 is open, with the development server left running.
- Implemented welcome, Google-only sign-in UI/adapter, protected shell, four-step resumed onboarding, Home, ECE subject enrollment/overview and editable Profile/sign-out. Arpan's teaching/lab screens and later Akshita intake/practice screens are explicit build-boundary placeholders.
- Latest after contract alignment: `npm run lint`, `npm run typecheck`, `npm run test` (26 tests), `npm run test:e2e` (14 Chromium tests) and `npm run build` passed. The original first slice had 21 unit/contract tests. API shape/access errors, wrong-profile denial, obsolete responses after account switching, auth loss, cancelled subscriptions, unsafe return destinations, refresh, failed save, resource cleanup and sign-out are covered at their respective test boundaries.
- Browser flow checks passed at 320/360/390/430/768/1024/1280/1440px without page overflow; keyboard/reduced-motion/rotation and a reduced landscape viewport passed. Reviewed laptop/phone Home and welcome/onboarding screenshots; Google Sans and Odia font loaded. Reduced viewport testing approximates available layout space at zoom; real browser/OS 200% text zoom and physical Android/iPhone/keyboard checks remain open.
- Connected production build excludes the synthetic fixture runtime; building fixture mode for production is explicitly rejected. Latest install audit found zero reported vulnerabilities. Build assets total about 153KB gzip before external fonts; no claim of a measured real-device transfer/performance gate.
- Web toolchain uses Node 24.12+ because the locked Firebase 13 SDK requires it. Used npm-provided Node 24 without changing the user's global Node 20 installation. Backend Python and emulator configuration remain separate.
- Firebase adapter and Python request boundary are implemented, but no real OAuth, emulator/full-stack, Firestore ownership, voice or phone-to-laptop persistence gate has passed. See `apps/web/CONTRACTS.md` and `.env.example` for setup needs. No cloud/remote configuration, commit or push occurred.

## Cold-pickup handoff

- **Last completed action:** implemented and verified the material/Library slice; inspected laptop/phone screenshots and updated the review guide/API handoff. New schemas and adapters preserve owners, source identity, request status and explicit sample controls. Latest complete checks: 33 unit/contract and 25 Chromium tests; lint/typecheck/build pass. Connected build lazy-loads form/request/Library pages and excludes preview stores/outlines.
- **Current working state:** frontend and plan changes remain uncommitted. Previously requested two JSON files were committed/pushed separately as `2a6c843`; this UI task does not include a commit/push. Pre-existing data-model edits remain untouched. Preview is running at `127.0.0.1:5173`.
- **Exact next action:** review Home → Add today’s material → save → sample outline → confirm → Library/originals. Align `apps/web/INTAKE_CONTRACT.md` with the Python owner. Next Akshita UI work is concept/chapter MCQs/results; Arpan supplies map/lesson modules. Live auth/upload/storage/OCR/generation, real phones and Simulink remain separate pending gates.
- **Do not repeat:** Google+password/OTP, phone-first layouts, old colours/fonts, diode content as the selected chapter, or mock-pointer activity as live Simulink guidance.
- **Intent:** start Akshita's UI work now without waiting for Arpan's full features.

## Status log

| Date | Completed | Still open / next |
|---|---|---|
| 13 October 2026 | First local React slice: welcome, sample entry, onboarding, Home, subject setup, Profile and responsive shell | Live Google/Python configuration; uploads/Library; Arpan's teaching/lab screens |
| 14 October 2026 | Arpan's contracts reconciled with current profile/auth/enrollment; shared resource cleanup added; 26 unit/contract and 14 browser tests pass | Python contract sign-off and live integration; material intake/Library next |
| 14 October 2026 | Added student click-through guide and feature-status table; confirmed preview HTTP response at `127.0.0.1:5173` | No new student feature was implemented during this documentation update; next feature remains material intake/Library |

## Material/Library slice — 14 October 2026

- Routes: `/subjects/:courseId/material`, `/intake/:requestId`, `/library`, `/library/:sourceId`. Home/subject buttons and recent-request cards connect them.
- In preview, actual PDF/JPEG/PNG originals and synthetic requests persist in browser IndexedDB, transactionally. Byte hashes protect same-key upload retries; originals can be viewed/downloaded. Files are not uploaded to Firebase in this mode.
- Form preserves valid attachments when another file is rejected. Stop upload is browser transport cancellation, not a server-job cancellation claim. Received records survive refresh/return; a full reload before the receipt can lose unsaved selection. This limitation is documented.
- Reading/outline/ready/failure sample states require explicit labelled controls. Confirmation saves selected concept/title edits; it does not generate lessons or erase learner evidence.
- Live HTTP transport is implemented with Firebase bearer headers, operation idempotency keys, validated response shapes and source metadata/binary checks. The Python endpoint specification is **proposed** in `apps/web/INTAKE_CONTRACT.md`; no actual backend/Firestore/Storage/extraction gate has passed.
- Current tests: 33 unit/contract and 25 browser tests pass, including original-byte preservation, same-key retry, ownership denial, malformed response, refresh/logout, image viewing, long names and all eight agreed widths. Reviewed form/outline/Library screenshots. Physical phone/keyboard and real browser text zoom remain open.
- Production entry JS is about 150KB gzip; three lazy material-page chunks add about 7KB gzip and shared CSS about 6KB. Fonts/real-device transfer performance were not measured. Fixture stores, sample outline data and sample jobs are absent from the production build.

| Date | Completed | Still open / next |
|---|---|---|
| 14 October 2026 | Material intake/status/outline confirmation and Library/original viewer; fixture recovery flow and real HTTP transport boundary | Python intake/storage/OCR/generation, physical devices; assessments/results next |

## Assessment slice — 14 October 2026

- Added `apps/web/active.md` as the user-requested current status record and `apps/web/AGENTS.md` to require updates after every completed frontend step.
- Implemented `/practice` and assessment assignment/draft/result routes. Concept checks use five bilingual questions and a 60% threshold; chapter checks use ten and 80%. Saved question positions/choices resume; failed checks show feedback/revisit and keep prior attempts on retry.
- Preview bank/scoring persist per synthetic learner, explicitly labelled and excluded from production. Optional chapter-ready setup records are marked as preview setup. Real scoring stays with Python; the proposed transport is in [ASSESSMENT_CONTRACT.md](../../apps/web/ASSESSMENT_CONTRACT.md).
- All ten concepts gate the chapter; only seven gate DSB-SC execution. Home green reflects quiz coverage only; other dimensions remain unassessed. Lesson/map/lab routes remain Arpan integration boundaries.
- Adopted one shared data router for pause confirmation. Replaced font-dependent icon ligatures with local vectors after a 320px overflow failure; existing Icon callers are preserved. Result opening focuses the summary for keyboard users.
- Verified 44 unit/contract tests and 36 browser tests, lint/typecheck/build; final assessment focus changes rechecked in the 11 assessment browser cases. Reviewed desktop/phone quiz and phone result images. Production build guard and fixture exclusion checked separately. Python/Firebase/real devices remain open.

| Date | Completed | Next |
|---|---|---|
| 14 October 2026 | Active frontend record; concept/chapter assessment UI and transport boundaries | Integrate Arpan lessons/map; agree and validate real Python endpoints |

## Firebase Google auth — 14 October 2026

Existing user-supplied Firebase project configured locally; Google provider/public name/support email and local domain settings saved with action-time approval. Real popup sign-in, identity restoration on full reload and sign-out passed. Added preflight/config validation, SDK-mock tests and a development-only connection review on separate port 5174; 5173 preview/file storage preserved. 51 unit/contract and 37 browser checks, lint/typecheck/build passed. Python bootstrap remains unavailable; no live profile/Firestore/Storage upload acceptance or sample-data migration. See [current status](../../apps/web/active.md) and [Firebase setup](../../apps/web/FIREBASE_SETUP.md).

## Python/Firebase profile connection — 15 October 2026

Added the user-requested minimal Python API under `apps/api`, mirroring the shared profile projection with actual OpenAPI. Verified Firebase Google identity/revocation through Admin, Firestore transactional bootstrap/preferences/enrollment, 17 API/contract checks and lint/format. With explicit user approval, created the private Mumbai Standard database and limited keyless service account; local Cloud SDK permission consent was separately approved. No service-account key or paid backup/billing upgrade.

Live browser: new profile → onboarding; saved-step reload; confirmation → Home; Profile retained default test preferences; sign-out then fresh Google sign-in → Home with no repeated onboarding. SDK probe passed and forged bearer returned 401. API 8000 and connected UI 5174 are running, browser left at Home. Existing fixture Library/quizzes on 5173 remain unchanged. Material/storage, evaluation, Arpan learning/lab and real-device gates remain pending. [Current frontend status](../../apps/web/active.md) · [Python status](../../apps/api/active.md).

## 15 October — private upload/Library local integration

Implemented Python owned multipart intake, validation, stable reservations/create-only originals and atomic receipt/source/deferred-job commit; cursor list/source/content endpoints; React stored status, paging and errors. 40 Python + 59 frontend + 37 preview browser checks and lint/typecheck/build pass. Real connected Library list verified via Google/Python/Firestore, but cloud originals remain blocked by disabled billing/absent bucket. Firebase console requires Blaze. Exact proposed setup and approvals: [STORAGE_SETUP.md](../../apps/api/STORAGE_SETUP.md). Current continuation remains [web active.md](../../apps/web/active.md).

## 15 October — Arpan map/lesson source pull and review

Correct source repository is Kikiland-ai/kiki-web, with features on ui/arpan-a11y (2256077), not main. Cloned separately, ran 205 tests/lint/typecheck/build and map/lesson browser/width checks. Labelled preview on 5180; existing 5174 app untouched. [Review](../ux/arpan-map-review.md) records integration requirements and verified gaps; [active status](../../apps/web/active.md) remains authoritative. No combined feature merge or production acceptance is claimed.

## 15 October — combined learning integration completed

Arpan map/lessons/terms and needed namespaced kit now run under current apps/web Gate/session. Preview has one assessment history, owned positions, profile dial, explicit save errors/retry, prerequisite notes and chapter/lab gates; no six-pass seed. Result/lesson/Home links form one flow. Full 50 browser tests and 93 unit/contract tests pass; final compact lab-list adjustment rechecked in 13 learning cases plus lint/build. Production asset checks exclude fixture learner/store/content/answer keys; current audit zero. Real Google/Home/Library still open; connected teaching reports pending API rather than sample fallback. Source 5180 checkout remains untouched. [Active status](../../apps/web/active.md), [walkthrough](../ux/ui-slice-review.md), [Python handoff](../../apps/web/LEARNING_CONTRACT.md). No commit/push/deploy or billing change.

## 15 October — Firestore learning connection

Original Analog Modulation ledger/Odia case imported as 68 immutable version documents plus head, excluding all learner seeds. Python now serves live teaching content, owner/version positions, assigned quizzes, draft revisions, grading/results and shared map progress. 65 Python checks, 93 frontend checks, full 52 browser checks, seven actual response-contract checks and lint/typecheck/build pass. All imported documents read back exactly; repeated import unchanged. User chose Semester 3; live enrollment, chapter, Step 2 reload/fresh-Google-sign-in resume and unanswered assignment/cursor resume verified. No real answers/grades fabricated; first student submit/result/map and physical-device acceptance remain next. Current record: apps/web/active.md; schema/import/rollback: apps/api/LEARNING_STORAGE.md.

## 16 October — lab preparation and saved sessions

Top-right Lab mode now opens live DSB-SC preparation: seven-concept readiness, 12 checkpoint reading positions, prediction/model reference/observation drafts, save/retry/conflict protection, copied owner-protected session locator and Home resume. Python/Firestore owner/version/revision boundary is separate from provisional live-execution LabApi. User assigns later screen-share monitoring/assessment backend to Aditya; pointer/verified evidence/practical scores stay off. 78 Python / 96 frontend / full 60 browser plus final 8 lab rechecks pass; public API receipts validate in React. Live checkpoint 2/revision 1 reload and Home resume verified with blank experiment reports. Same-computer links work; actual phone/laptop continuation needs shared reachable hosting and device acceptance. Canonical status: apps/web/active.md; boundary/handoff: apps/web/LAB_PREPARATION_CONTRACT.md.

## 16 October — DSB-SC teaching diagrams

Connected C-AM-04 Concept/Application placards now include message × carrier → signed Product output, accurate positive-frequency sidebands, a local message-frequency control/reset and linked English/Odia glossary highlights. Optional source-backed lesson.visual projection uses existing immutable Firestore content with no catalog/progress migration. 80 Python / 100 frontend / full 67 browser, actual API/React contract checks, lint/typecheck/build/OpenAPI and BB8 checks pass. Live Google lesson/frequency/term sheet/reload plus phone-sized emulation reviewed. No fabricated mastery, narration or Simulink monitoring; Aditya integration remains deferred. See apps/web/active.md and TEACHING_VISUALS.md.

## 16 October — shared kiki-web checkpoint

User authorized source publication to Kikiland-ai/kiki-web. An isolated integration branch retains existing main/Arpan ancestry and contains the combined apps/web + apps/api, required content/runtime/SVG snapshots, status and team handoff. Local env, credentials and generated artifacts are excluded. The user confirmed author/committer akshitanitr. Fresh checkout validation is recorded in TEAM_HANDOFF.md; source publication does not deploy or alter Firebase.
