# Chapter and lesson integration boundary

15 October 2026 · Python content/positions/progress and authoritative assessment endpoints are now implemented. The source catalog is imported to Firestore; see [LEARNING_STORAGE.md](../api/LEARNING_STORAGE.md) and [active.md](active.md) for actual live acceptance.

## Student flow

`/learn` redirects to `/chapters/LP-ANALOG-MODULATION` under the current authenticated Gate. Chapter nodes open `/concepts/:conceptId`; four placards lead to `/assessments/AS-AM-xx/new`, the existing question/result screens, and back to the same chapter. Home and subject overview link to the chapter. Unknown preview IDs show a not-found screen; unavailable connected content shows a retry/error screen.

The shared shell, Google/profile/onboarding, material Library and existing assessment routes remain in apps/web. This is not the sibling Arpan checkout's placeholder app. The full combined flow is demonstrated with **Open sample student** on 5173. Real Google/profile mode on 5174 remains real; it never falls back to this sample course or scores.

## Public shapes and implemented Python endpoints

Runtime schemas: `src/contracts/learning.ts`; interfaces: `api.ts`, `services.ts`. All calls require a Firebase bearer token; UID comes from verification. API base URL remains the configured base (currently http://127.0.0.1:8000). PUT is included in the exact-origin CORS configuration.

| Route | Envelope / behavior |
|---|---|
| GET `/lesson-plans/{planId}` | `{chapter: ChapterView}`: IDs, bilingual titles, sections, prerequisites, concept assessments and review flags; no question keys |
| GET `/concepts/{conceptId}/lesson` | `{lesson: ConceptLesson}`: four definition/concept/application/recap placards, terms/source refs and media readiness; no scoring keys |
| GET `/learners/me/progress?planId=...` | `{progress: ChapterProgress}`: required **ownerLearnerId** (new aligned field), concept latest-check status, positions, rings, chapter test and seven-concept lab readiness |
| PUT `/learners/me/positions/{conceptId}` | `{placardId}` → `{position: ConceptProgress}`; verify content access and placard membership, preserve unrelated state; repeat-safe same-position writes |

404 for absent content, 401/403 for identity/access, 422 for invalid fields, 503 for unavailable dependencies. The frontend validates response shape, requested IDs and progress owner, and rejects readiness inconsistent with the seven checks. No direct browser Firestore writes.

The implemented routes and Pydantic models are exported in ../api/openapi.json. Actual Python chapter/lesson/progress/position/run/result/overview receipts pass the existing React Zod schemas via scripts/check-python-learning.mjs. Enrollment is required; owner comes from the verified Firebase token. Live reading/resume and scoring acceptance are tracked separately in active.md.

## What is actually connected in preview

`createFixtureServices` composes a single AssessmentApi and passes it to `createFixtureLearning`. Map progress is a projection of that same API's latest evaluated attempt per concept. It does not import Arpan's synthetic six-pass learner or global fixture store. Existing browser sample attempts remain intact. The current preview still repeats the same question bank; variant generation is not claimed.

Positions use `kiki:learning-positions:fixture:v1:{uid}`, with explicit owner/schema/timestamp and placard validation. They survive reload/re-sign-in in the same browser. Corrupt records are preserved with a visible error. Write failures show not-saved + Retry; reading/position never awards a check pass. Account changes and unmount abort/ignore pending private reads and position responses.

The dial uses the same Session/profile update as Profile/onboarding, with serialized latest-choice persistence, visible errors and Retry. There is no unscoped `kiki.dialLevel`. The lesson's optimistic language selection stays readable when saving fails.

## Progress rules

- No evaluated work: rings say **Not assessed**. Reading can mark Learning only.
- Five concept MCQs: ≥3/5 passes. Latest evaluated retry drives map/revisit/readiness; all previous attempts remain in history.
- Green ring = passed checks / assigned checks. Per-node coverage is 1/1 when passed, 0/1 when evaluated and not passed, null before evaluation. **Latest check: N%** shows accuracy separately.
- Red/English/practical rings stay unassessed until their own evaluated evidence exists.
- All ten passed concepts unlock the chapter test; 10 bilingual questions, ≥8/10 passes.
- DSB-SC execution uses only C-AM-01/02/03/04/06/07/08; chapter test never gates it. Preparation remains accessible. Missing checks are expandable so a new student's map is not dominated by a seven-item lab list.
- Later lessons can be previewed with prerequisite explanations. Map is grouped tiles/phone rows; full drawn dependency wires remain later visual work.

## Mode and asset isolation

Only the explicit development fixture branch imports learning-content.json, fixture positions and preview scoring. Connected production builds contain the HTTP adapter and UI only: no source fixture learner IDs/store, teaching fixture JSON, answer-key fields or preview scoring adapter. Visible draft/sample labels may remain as UI strings; they are not fixture records.

Keep current package/lock/toolchain. Required Arpan components are namespaced in ui/learning with --learning-* tokens and modal portal support. Older source lockfile/advisories and global base styles were not imported.

## Evidence / remaining work

93 frontend unit/contract checks and full 50 browser checks passed, covering combined lesson/quiz/map, thresholds, save failure/retry, sign-out/re-entry and 320–1440px screens. After the final compact lab-list adjustment, all 13 learning browser checks passed again, with lint/build rechecked; see active.md. Audit reports zero advisories in the current app. Real phones, text zoom/keyboard overlays, expert content/Odia review, media and actual simulator observation remain separate gates. Python implementation and current live persistence evidence are recorded in active.md.

## 16 October — optional teaching visual

C-AM-04 now exposes the optional public `lesson.visual` projection and renders signal-flow/spectrum diagrams on Concept/Application placards. Existing immutable catalog and progress version remain unchanged. Source defaults/range come from the stored authored concept; local exploration never saves evidence. See [TEACHING_VISUALS.md](TEACHING_VISUALS.md) for DTO, math assumptions, source references, fixture isolation, verification and rollback. Current acceptance counts remain in active.md.
