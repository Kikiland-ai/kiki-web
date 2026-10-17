# Assessment UI/API handoff — Python implementation

The React adapters, labelled preview and Python/Firestore implementation are aligned. Actual Python public receipts pass src/contracts/assessment.ts runtime validation, and the running API exports the implemented routes in ../api/openapi.json. See [LEARNING_STORAGE.md](../api/LEARNING_STORAGE.md) and [active.md](active.md) for storage/version/idempotency details and live acceptance.

## Authority and assignment

Python verifies the Firebase bearer token, derives the learner UID and checks ownership on every request. No caller-supplied UID, correctness, percentage or mastery field is authoritative. Public assigned questions contain only `questionId`, `conceptId`, bilingual `prompt` and equally ordered `options.en` / `options.or`. Never send answer keys or pre-submission explanations. Canonical English technical terms remain in the Odia wording.

- `AS-AM-01` through `AS-AM-10`: five questions each; **3/5 (60%)** passes.
- `AS-AM-CHAPTER`: ten questions, one per chapter concept; **8/10 (80%)** passes.
- Current chapter: `LP-ANALOG-MODULATION`, course `CRS-AC-ECE`.
- All ten current-version concept checks gate a new chapter test. Only `C-AM-01/02/03/04/06/07/08` gate DSB-SC lab execution; the chapter test never gates that lab. These theory gates alone do not activate the pointer or certify lab performance.
- Use the latest completed result for each concept in the current content version. Starting an unfinished retry does not erase the last result. Preserve previous attempts, immutable assignments and their content versions.

## Operations

All routes use `Authorization: Bearer <Firebase ID token>`. Mutations use `Idempotency-Key`; same key/body must return the original receipt and must never create a duplicate attempt, draft revision or result. A reused key with different body must fail. Adapters apply a 15-second request deadline and abort on account change/sign-out.

| Method/path | Body | Envelope / effect |
|---|---|---|
| `POST /assessment-runs` | `{ assessmentId, previousRunId? }` | `{ run }`; validate access/prerequisites and retry lineage, allocate one immutable assignment; return an existing active run when appropriate |
| `GET /assessment-runs/{runId}` | — | `{ run }`; owned assignment and last saved draft |
| `PUT /assessment-runs/{runId}/draft` | `{ responses, currentQuestionIndex, expectedRevision }` | `{ run }`; atomically save partial choices and question position; increase revision; reject stale writes |
| `POST /assessment-runs/{runId}/submit` | `{ responses }` | `{ result }`; require one valid option for every assigned question, grade on the server, atomically finalize once |
| `GET /assessment-runs/{runId}/result` | — | `{ result }`; immutable evaluated result; incomplete runs have no result |
| `GET /learners/me/assessment-overview?planId=LP-ANALOG-MODULATION` | — | `{ overview }`; current-version concept status, chapter/lab readiness and owned attempt history |

Each response choice is `{ questionId, optionIndex }`, with zero-based indexes. Reject duplicate/foreign questions, out-of-range/non-integer choices and incomplete submissions. Submission retries with identical choices must return the same result even after an uncertain response; different choices cannot replace a finalized result. Return 401 for expired identity, 403/404 for denied resources, 409 for stale revisions/prerequisites/conflicting finalization, 422 for invalid input and 5xx for availability failures. Do not return successful saves on failed storage/evaluation.

## Response shape

`AssessmentRun` retains `runId`, `assessmentId`, `scope`, `attemptNumber`, `passPercent`, `questions`, `createdAt`, and adds:

- `ownerLearnerId`, `contentVersion`, nonnegative integer `revision`;
- `status: in_progress | submitted`;
- `responses` and zero-based `currentQuestionIndex`;
- `origin: student_attempt | preview_setup`. Connected servers should return only `student_attempt`; the second value is exclusively a labelled development setup.

`QuizResult` includes owner/version/run/assessment identifiers, `correct`, `total`, exact `percent`, `passPercent`, `passed`, `completedAt`, `byConcept`, `revisitConceptIds`, `nextAction: continue | revisit_then_retry`, and bilingual post-submission `feedback`. Each feedback row is `{ questionId, correct, explanation: { en, or } }`; each breakdown row has `correct`, `total`, `missedQuestionIds`. Values must agree with the immutable assignment and integer threshold comparison. UI runtime validation rejects inconsistent receipts; it does not replace backend authorization or evaluation.

`AssessmentOverview` includes `ownerLearnerId`, `planId`, `contentVersion`, ten unique `concepts` rows (`conceptId`, `assessmentId`, `title`, `status: not_attempted | passed | revisit`, `latestRunId`, `percent`), `chapterAllowed`, `chapterMissingConceptIds`, `labReady`, `labMissingConceptIds`, `chapterTestRequired: false`, and `attempts: [{ run, result: result | null }]`. The live service returns the latest 15 runs plus any older active runs (at most 11). Latest-result summaries are independent of that window; older owned runs remain retrievable by ID. A paging UI remains later work.

## React connection points

`Services.assessments` is required. Methods are `start`, `get`, `saveDraft`, `submit`, `getResult`, `overview`; `previewChapterReady` is optional and development-only. Existing first argument and optional AbortSignal positions are preserved; operation keys and retry lineage follow them. Use the canonical TypeScript interfaces rather than a separate DTO store.

- `/practice`: check list, owned history and prerequisite summary.
- `/assessments/:assessmentId/new`: assign/resume; optional `?previousRunId=...` for retry.
- `/assessments/:assessmentId/:runId`: saved draft or completed result.
- Arpan's lesson completion CTA should start its `AS-AM-xx` check; chapter/map can link to `/practice`. Read `useAssessmentState()` for the current projection; refresh after a result. Reading a lesson never fabricates a pass.
- Router composition uses `createAppRouter()` in `src/app/App.tsx` and React Router's data router so pause confirmation covers in-app/back navigation. Register modules in that shared router.

## Preview and remaining gates

The development-only question bank is copied from the committed Analog Modulation case and ledger. Keys/scoring/localStorage are excluded from connected production. The preview persists per synthetic UID in this browser only and repeats the current sample bank; it cannot certify proficiency or demonstrate cross-device state. Odia wording and question equivalence remain drafts requiring instructor/Odia-reader review.

“Load chapter-ready preview” explicitly creates labelled passed prerequisite setup records without deleting student attempts. It exists to review the chapter screen quickly; it is not real evidence. Do not expose that method through Python. Result review confirmation is a student's self-report, not proof of lesson completion.

Implemented/checked: Python routes/OpenAPI, DTO agreement, transactional ownership/idempotency/revisions, server scoring against the authored draft bank, version separation and the combined map/lesson flow. Outstanding acceptance: actual concurrent cloud contention; instructor/Odia review; real student quiz submission/result acceptance; physical phone/laptop resume, keyboard/text zoom and later integrations. See active.md for the current live record; preview/test-double scores never certify these gates.
