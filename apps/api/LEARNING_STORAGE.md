# Learning content and student state in Firestore

15 October 2026 · Python/React boundary implemented · Catalog imported to builder-cup-a8479

## Data layout

- `learningCatalog/LP-ANALOG-MODULATION`: active-version pointer.
- `learningCatalog/LP-ANALOG-MODULATION/versions/{version}`: immutable manifest with hashes, review labels and counts.
- Under each version: `chapters`, `lessons`, `terms` (source + view), `courses`, `practicals`, `privateAssessments`, `sourceConcepts`, `sourceSections`. The complete authored ledger/case is reconstructible from these records, excluding **case.seeds**. Text/media specifications are retained; this does not create images/audio or a simulator integration.
- `learners/{verifiedUid}/learningStates/{planId}-{version}`: owned placard positions, latest completed check summaries, active run references, attempt counters and latest 15 run IDs. Reading changes no score.
- `learners/{verifiedUid}/assessmentRuns/{runId}`: immutable assignment and private answer snapshot, revisioned draft and immutable submitted result. All attempts remain stored even when outside the recent-history window.
- `learners/{verifiedUid}/learningOperations/{sha256(key)}`: request fingerprint and original receipt. Same key/body replays exactly; a different body/operation with that key conflicts. Receipts currently persist without TTL.

The browser uses authenticated Python HTTP APIs only. Existing direct-client deny rules remain unchanged. Private source sections and assessment keys have no public endpoint. Public DTOs allowlist the fields sent to React; question explanations appear only after submission. Profiles/materials are preserved.

## Import or update

Run from apps/api with the locked environment:

```sh
.venv/bin/python scripts/import_learning.py
.venv/bin/python scripts/import_learning.py --apply
```

The first command is a credential-free dry run. The second writes only catalog content and its active pointer. The source is the two original data-model JSON files, never a preview-generated bank. Initial import creates 68 version documents plus the catalog head. Same input is unchanged on repetition. No learner/profile/score seeds are imported.

For a future source revision, inspect the active version and pass it explicitly:

```sh
.venv/bin/python scripts/import_learning.py --apply --expected-current CURRENT_VERSION
```

Activation is a single Firestore transaction with a compare against the previous pointer. Existing immutable manifests must match, never overwrite in place. Keep the JSON files in Git. Change the projectionSchema when changing projection semantics. Old catalog versions and attempt documents remain available; new-version readiness starts without borrowing old scores. Historical runs retain their original private grading snapshot and can still be retrieved/submitted by their owner.

Rollback: use the importer for the earlier source revision with the actual current version passed as --expected-current. Do not delete versions or student states. This restores the older active catalog and its separate state; it does not rewrite scores.

## Implemented HTTP surface

All paths require verified Google identity and existing Analog Communication enrollment. A missing enrollment returns 403 with an actionable React message. IDs come from route fields; owner UID always comes from Firebase verification.

- GET `/lesson-plans/{planId}` → `{chapter}`
- GET `/concepts/{conceptId}/lesson` → `{lesson}`
- GET `/learners/me/progress?planId=...` → `{progress}`
- PUT `/learners/me/positions/{conceptId}` with `{placardId}` → `{position}`
- POST `/assessment-runs` with `{assessmentId,previousRunId?}` → `{run}`
- GET `/assessment-runs/{runId}` → `{run}`
- PUT `/assessment-runs/{runId}/draft` with `{responses,currentQuestionIndex,expectedRevision}` → `{run}`
- POST `/assessment-runs/{runId}/submit` with `{responses}` → `{result}`
- GET `/assessment-runs/{runId}/result` → `{result}`
- GET `/learners/me/assessment-overview?planId=...` → `{overview}`

Assessment mutations require an 8–128 character Idempotency-Key using letters, numbers, hyphens or underscores. Draft revision is optimistic and atomic. One active attempt per assessment/version; repeated start resumes it. Completed submissions are immutable: identical choices return the original result, different choices conflict. Client-supplied correctness/owner/mastery fields are rejected. All state/attempt/receipt writes commit together and are retried by Firestore on contention, following [Firestore transaction guidance](https://firebase.google.com/docs/firestore/transaction-data-contention).

Progress and overview derive from the same transactional latest-result summaries. Concept ≥3/5; chapter ≥8/10. All ten latest current-version concept passes gate a new chapter assignment; seven specific passes gate lab execution readiness. Beginning a retry leaves the previous result in force until submission. Chapter results do not gate lab, reading gives no mastery, and practical/words/English remain unassessed. Overview returns at most 15 recent plus up to 11 older active runs; direct owned retrieval retains older attempts. No history paging UI yet.

## Checks and boundaries

65 Python tests (40 existing + 25 learning), Ruff, generated OpenAPI, and actual Firestore SDK serialization pass. Learning tests cover denied identity/enrollment, two-account ownership, partial resume, stale revisions/idempotency, invalid responses, private keys, 2/5 versus 3/5, 7/10 versus 8/10, lab/chapter gates, latest retries and version separation. Test doubles check read-before-write ordering but do not prove real concurrent contention.

React receipt verification after pytest:

```sh
# From apps/web:
npm exec --yes --package=node@24 -- node scripts/check-python-learning.mjs
```

This reads ignored API test artifacts and validates all seven actual Python response envelopes against React's existing Zod schemas, plus result-assignment consistency. It is a local verification command, not app runtime or a fixture fallback.

Live catalog import and a second unchanged import succeeded. All 68 Firestore documents were read back and compared with the importer output. Actual browser acceptance and latest frontend checks are recorded in ../web/active.md. No cloud billing, Firebase Storage, IAM, security-rule, deployment or Git changes are included. Content/Odia remain draft; retries use the same authored questions. Physical-device resume and real grading acceptance remain distinct from test-double scoring.

## Teaching-visual read projection — 16 October

`GET /concepts/C-AM-04/lesson` additionally projects an optional `lesson.visual` (`dsb-sc-visual/v1`) from the same version's `sourceConcepts/C-AM-04`: allowlisted renderer kind, Hz baseline/range, glossary references and authored source citations. Original immutable lesson documents remain untouched. No import, catalog-head/version change, new document, student-data migration or access change is needed. Other lessons omit the field. React validates it and implements a known analytic teaching model; authored strings are never evaluated. Parameter exploration is local and creates no evidence. See ../web/TEACHING_VISUALS.md for UI assumptions/rollback and active.md for current verification.
