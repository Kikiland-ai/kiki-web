# Python API — active status

Updated: 16 October 2026
Current step: optional authored DSB-SC teaching projection completed; screen-share monitoring/assessment deferred to Aditya

See [../web/active.md](../web/active.md) for the student walkthrough/current acceptance and [LEARNING_STORAGE.md](LEARNING_STORAGE.md) for data paths, migration, rollback and API rules.

## Completed

- Existing FastAPI/Pydantic profile bootstrap, GET/PATCH and enrollment; Firebase Admin Google token signature/project/expiry/revocation checks; UID-derived ownership. Locked Python 3.12.15/uv dependencies.
- Existing private-original upload/list/source/content adapters and real owned Firestore Library metadata reads. Originals remain unavailable until usable private Storage is identified.
- Versioned catalog importer from the original analog-modulation ledger/Odia case; credential-free dry run, seed exclusion, lossless authored-content preservation, immutable version documents and atomic compare-before-activate. Live initial import and repeated unchanged import succeeded; all 68 version documents read back and matched exactly. Active head adds one document. Version am-51187527300cba2fa3cca868.
- Authenticated Firestore chapter/lesson, UID/version positions, immutable private-key-snapshot assignments, optimistic revision drafts, server grading, immutable results, idempotent operation receipts and unified latest-result/progress projections. No runtime fixture fallback.
- Public DTOs/OpenAPI match the current React Zod contracts for all seven envelopes. PUT is enabled only for existing exact CORS origins. Browser Firestore deny rules remain unchanged.
- Bound recent history (15 plus older active attempts), complete attempt retention, current-version gates and previous-run lineage checks. Reading/preferences never grant a pass.

## Verification

**65 Python tests**: 17 profiles + 23 materials + 25 learning; Ruff lint/format and exported OpenAPI. Test doubles enforce reads before writes and check ownership, revisions, replay/conflict, private keys, option validation, 2/5 versus 3/5, 7/10 versus 8/10, seven lab prerequisites, all ten chapter prerequisites, latest completed retries, source reconstruction/seed exclusion and version isolation. They do not prove actual concurrent Firestore contention.

Web: 93 unit/contract and full 52 browser checks, lint/TypeScript/build. Explicit scripts/check-python-learning.mjs validates actual API pytest receipts against React's runtime DTOs and result-assignment consistency.

Live: existing Google profile/onboarding/return works. User chose Semester 3; enrollment saved through app. Connected map opens with no artificial passes, bilingual Concept 1 saves Step 2, reload restores it, and a second independent Google sign-in restores it. Real assessment overview/assignment and empty-draft cursor saves/reload work. No answers or graded results were invented for the student. First real student submission/result acceptance and a physical phone/laptop pair remain pending.

## Running and access

API http://127.0.0.1:8000; connected React http://127.0.0.1:5174; labelled browser preview http://127.0.0.1:5173. /health is process liveness only. /docs and openapi.json cover actual implemented routes. See README.md for restart; .venv and .tools/uv are prepared.

Approved private Standard Native (default) Firestore in Mumbai asia-south1, existing deny-all direct-client rules, dedicated keyless kiki-profile-api account with Firestore read/write and Auth read, and scoped impersonation. Isolated local ADC/env files stay ignored; no private key. No auth bypass, new IAM scope, billing, Storage provisioning, paid backups, deployment or Git operation.

## Now / Next / Later

- **Last completed:** versioned catalog + Python learning/assessment connection, contract/tests, live import/read-back/lesson resume and unanswered assignment/draft-position acceptance.
- **Next:** student submits the actual first concept check; verify result → same map and retry/re-entry. Follow with physical phone/laptop resume and realistic concurrency testing in an isolated emulator/test environment.
- **Parallel dependency:** colleague checks an existing Firebase Storage project/bucket/access. User explicitly declines all payments/billing upgrades. Existing builder-cup-a8479 default bucket is absent (404); public key/web-app pair is valid but cannot provision Storage. No local-disk fallback was activated.
- **Later:** instructor/Odia review, generated-source/material pipelines, media/English evidence, actual Simulink/hardware integrations and release checks.

Old profile/material implementation evidence remains in README.md, STORAGE_SETUP.md and build history. Existing real onboarding/preferences and unrelated learner fields were preserved; only the explicitly chosen Semester 3 enrollment, lesson place and unanswered assignment/cursor were added during live acceptance.

16 October user acceptance: after reviewing the live quiz, the user reports it is working. No new agent-generated answers/scores. Frontend active.md now recommends lab preparation/owned saved sessions as the next implementation slice; reconcile the existing lab contract before coding. Supported Simulink observation/pointer and physical-device continuation remain separate gates.

## 16 October — Lab preparation persistence

Implemented GET practical, POST/start preparation, GET active/get owned preparation and revisioned PATCH. Firestore learners/{uid}/labPreparations/{id} and labPreparationHeads/{version}; catalog version pinned. Preparation is allowed before seven checks pass; readiness comes from that version's existing assessment summaries. Save/replay is repeat-safe, stale different writes conflict, previous text is preserved for explicit review, and unrelated profile/learning/material data stays intact. The session URL is an authenticated owner-only bookmark, not an execution lease or access token.

**Aditya owns later screen-share monitoring/assessment.** No trusted evidence, completion, practical grade or active pointer endpoint is introduced. Preparation monitoring fields are server-constant pending_integration/false/not_assessed; injected trusted fields are rejected. No Storage, billing, IAM, rules, deployment or Git operation.

**78 Python checks**, Ruff, actual OpenAPI, **96 frontend / full 60 browser + final 8 lab rechecks**, build/lint and public response contract checks pass. Live real Google account created a preparation, saved checkpoint 2 at revision 1 and restored it after reload; current readiness 1/7 matches the student's real 80% concept result. No student prediction/observation or score was invented. See ../web/LAB_PREPARATION_CONTRACT.md and ../web/active.md. Exact next: user review of saved preparation; later align Aditya's actual trusted observation/assessment protocol. Actual phone/laptop testing needs a shared reachable app URL.

## Latest: teaching-visual projection — 16 October

Existing authenticated C-AM-04 lesson reads its already-versioned authored source and returns optional `visual` (dsb-sc-visual/v1). Source-driven defaults/range, renderer/glossary references and citations only; no executed formulas, writes, reimport, version/head change or progress migration. Catalog remains am-51187527300cba2fa3cca868. Other lessons omit visual. See ../web/TEACHING_VISUALS.md.

**80 Python / 100 frontend / full 67 browser**, Ruff/ESLint/typecheck/build, ten actual Python→React envelope checks and OpenAPI export pass. Numerical browser tests verify real SVG positions, not merely a changed label. Connected real Google lesson/200 Hz change/reset/Odia term sheet, Step 2 save/reload and a 390 px emulated view verified. No graded learner data or lab preparation changed. Earlier pending quiz/lab acceptance entries above are historical; ../web/active.md is current. Exact next: student reviews C-AM-04 diagrams, then reviewed narration content/provider work. Aditya's trusted monitoring/assessment stays deferred.

Shared kiki-web publication: the Python slice and required content snapshot are included on integration/connected-kiki-2026-10-16. A fresh locked environment passes all 80 Python checks and actual response-contract validation; no credentials or live database access are required for those tests. Root TEAM_HANDOFF.md documents team setup. Personal one-off IAM setup script, local env/ADC/tools and generated receipts are excluded.
