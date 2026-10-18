## PR publication checkpoint — 18 October 2026

User authorized a new PR for the generic account-preference UI. Branch `redesign/aditya-multilingual-profile` now includes latest `main` (`b984c64`, merged #7/#8); pending #9 remains separate.119 API tests, Ruff/format, exact OpenAPI consistency, Python→React receipts,185 frontend tests/build/lint and16 journey/preference browser cases pass. The additive metadata preserves existing records and older-client saves; teaching/media contracts remain Odia/English. Local preview credential-path recovery is documented but its credential files/process configuration are excluded from Git. Genuine signed-in browser/profile retry remains a separate acceptance check. Preparing commit/push/new PR only; no merge, cloud change or learner migration. Earlier local-only statements below are historical.

## Local preview credential-path recovery — 18 October 2026

The reported Google-success/profile-failure was bootstrap503 with `DefaultCredentialsError`: the preview loaded the original checkout's relative `CLOUDSDK_CONFIG` while running from this worktree. Restarted API8001 with that existing approved path resolved against the env file's directory; no credential-file copy, new authentication, IAM, billing or learner write. SDK connection probe reads only the deliberately nonexistent probe document and passes; the restarted API returns401 for an invalid bearer rather than503. README records worktree launch-path handling and health-versus-readiness checks. Genuine signed-in profile retry remains for the user at connected5194. Frontend welcome cleanup and contextual profile-load error copy pass11 focused tests, lint and TypeScript. No commit/push/deployment.

## Generic learning preferences — local UI revision, 18 October 2026

`redesign/aditya-multilingual-profile` adds bounded language preferences beyond `or`/`en` and optional `studyField` metadata, with matching Zod/OpenAPI. Existing profile fields/enrollment are retained. Older update payloads do not clear the new field; learning/media DTOs remain the existing bilingual authored package. New profiles default to unconfirmed English; Aditya's fixture explicitly starts Odia/ECE. No actual translation pipeline/curriculum expansion or Google identity rename is claimed.

**119 API tests** and Ruff/format pass, including generic/custom preference persistence, preservation of unknown learner evidence and older-client field retention. Frontend183 tests, code/build/contracts and16 relevant browser cases pass. API8001 restarted from this worktree using approved config only in its process; public OpenAPI confirms the new field. No live Google/Firestore profile mutation, IAM/billing/Storage change, model call or deployment. Source remains local/uncommitted; next is user UI review. [Current frontend status](../web/active.md), [contract/UX handoff](../web/MULTILINGUAL_PROFILE_UI.md).

## Status — 18 October 2026, after merge

**Merged, 18 October:** the implementation is on `main` as PR #7 (`0ee6646`, merge `0ed7c06`). The kiki-backend code it calls is on kiki-backend `main` (its PR #3); the backend branches named in older notes were deleted after that merge. Open items by owner are in the [kiki-backend lab handoff §0](https://github.com/Kikiland-ai/kiki-backend/blob/main/docs/handoffs/kiki-web-lab-mode-screen-share.md); testing across machines (SSH forward, ngrok or Tailscale) is in [connected integration testing](https://github.com/Kikiland-ai/kiki-backend/blob/main/docs/plans/connected-integration-testing.md).

## PR #6 — local execution relay, 18 October 2026

Source publication authorized on `feature/lab-screen-share-implementation`, based on plan PR #6 `29724c7` / redesign main `93cce9b`. Aditya's approach is approved; user chose local only. New fixed execution routes reuse Google Firebase identity, enrollment and owner preparation checks, reserve one Firestore link before upstream creation, forward server-owned headers only, enforce body/image/stream bounds, pass409 conflicts, map dependency failures safely, relay SSE incrementally and close ticketed WebSockets on revocation or lost access. Monitoring enum is reconciled in Pydantic/Zod/OpenAPI; no assessed evidence, grade, pointer or original-file Storage change.

**118 Python tests pass**, plus Ruff check/format across src/tests/scripts, regenerated OpenAPI, existing Python→React contracts and actual Python upstream/native-extension acceptance with a test-only verifier/store/fake analyzer. Frontend has180 passing tests, lint/build and nine relevant browser tests (one expanded extension test + eight preparation regressions). No new live Firebase/Firestore read/write or external provider trial was claimed by these doubles. Test subprocesses/profile are closed.

Feature defaults disabled. Enabled local mode requires exact127.0.0.1:8100, a shared32–256-character server secret, one API worker and reader Origin5174. HMAC opening tickets expire after60s and are single use; Firebase tokens stay in worker memory. The pinned upstream lacks durable idempotency replay: an ambiguous first response leaves the reserved link awaiting reconciliation, rather than retrying into duplicate labs. Multi-worker tickets and automatic crash recovery are future hosting gates. B1/B2 production setup and student-controlled MATLAB/provider trial remain pending. User authorized commit and push of this separate branch; no PR update, merge, cloud/IAM/billing/Storage or deployment.

Last completed: local relay, runtime parity, protocol/capture acceptance and documentation. Next: manual trial against the approved configured local analyzer. [Authoritative frontend status](../web/active.md), [setup and implementation limits](../web/LAB_SCREEN_SHARE_IMPLEMENTATION.md). Historical source-publication/preparation-only entries follow.

# Python API — active status

Updated: 18 October 2026
Current step: PR #2 media and PR #3 Windows fixes integrated alongside Library text

See [../web/active.md](../web/active.md) for the student walkthrough/current acceptance and [LEARNING_STORAGE.md](LEARNING_STORAGE.md) for data paths, migration, rollback and API rules.

## Published source

Combined source checkpoint `e951a83` is pushed on `redesign/sketchbook-refinement`; [PR #5](https://github.com/Kikiland-ai/kiki-web/pull/5) targets `main`.104 Python tests and API/contract checks pass. No deployment or cloud media publication. Older PRs stay open pending replacement merge/coverage check.

## Publication review — 18 October

104 Python tests, Ruff/format, OpenAPI consistency and Python→React receipts pass. Optional media calls now validate learner context before resolving the adapter method: absent adapter returns503 to enrolled learners and403 to unenrolled learners, with complete text lessons preserved. New regression covers manifest/assets. No DTO/cloud/storage change. User authorized branch publication/new replacement PR; older PRs remain open pending merge/coverage confirmation. [Current combined status](../web/active.md).

## Local integration — 18 October

PR #2 `df2de21` concept-media source and PR #3 `4290e0f`/`1ad4d58` Windows fixes are integrated locally into `redesign/sketchbook-refinement`, alongside the existing Firestore document-text endpoints and static Library UI. Regenerated OpenAPI includes both boundaries. **103 Python tests**, Ruff/format and Python→React contracts pass; frontend has 154 passing tests. Publish script dry run validates all 8 assets without cloud writes. No media bucket is configured; optional media stays absent on connected lessons, preserving complete text. API8001 restarted with existing approved config in process only; unauthenticated media returns 401. No fresh authenticated live-data acceptance, IAM/billing/storage change, commit/push/PR merge or deployment. [Combined integration evidence](../../docs/plans/sketchbook-pr-integration.md). Historical status below describes earlier checkpoints.

## Current product decision — static upload history

The user confirmed a real lecture PDF extracts/saves successfully and its text is visible in Firestore. They now want extraction kept as an internal implementation detail. Library shows one static, non-interactive card per source: filename, material type, topic, uploaded date and Uploaded status. No Open request, text reader or original-download links. The upload form keeps processing internal, shows selected filenames, and returns directly to Library after successful Upload material. Paste/review/extraction/storage copy is removed from the product UI; old text source/receipt links redirect to Library. Home uses generic upload wording. Existing Firestore text/chunk APIs, auth, ownership and saved records are unchanged.

Verification: **138 frontend tests**, ESLint and TypeScript/production build pass. Regression checks cover static cards, old-reader redirects, hidden content still reaching the existing save transport, mixed document failures and empty-upload prevention. Connected Library reads both existing records, including the user's actual lecture; cards contain zero interactive controls. Library and upload form have no horizontal overflow at eight widths, 320–1440px. The browser material suite was updated for the new flow but not executed. Final publication recheck: all 94 Python tests, Ruff/format, Python→React response contracts, OpenAPI consistency and production fixture/answer-key exclusion checks pass. No new live record, learner evidence, billing or security change in this UI step.

Proof: ignored `apps/web/test-results/document-text/library-upload-cards.png`. Local connected review remains **http://127.0.0.1:5194/library**; sample 5193. Last completed: user accepted the PDF upload/static Library flow; final source review and checks pass, including a fresh connected Library reload. User authorized commit and push on 17 October to `origin/feature/library-text-content`, authenticated/attributed as `akshitanitr`. This checkpoint is for source publication only; no deployment. Exact next product step: real PPTX smoke test and later integration with the separate in-progress build when ready. Full automated browser suite was not rerun.

The text-reader/review acceptance below is historical implementation evidence and is superseded by the current product decision.

## Text-only Library — 17 October

User clarified that PDF/PowerPoint content should be retained as text in Firestore; original media does not need to be stored. Work is isolated in `feature/library-text-content` / `kiki-web-library-text`, based on published redesign `2cfc241`. [Plan](../../docs/plans/library-text-content.md).

Implemented browser PDF/PPTX extraction/review and paste-text fallback, explicit authenticated JSON text intake and paginated reads, atomic UID-owned Firestore text chunks, honest Text saved/original not stored views, and browser-only sample persistence using the same text extraction. Existing original-file endpoints and saved records are preserved. No billing, Storage, IAM, auth bypass or source-catalog changes.

Verification: **134 frontend and 94 Python tests** pass, with ESLint, Ruff/format, TypeScript/production build and Python→React response checks. Actual PDF/PPTX parsers are tested. Browser sample review/save/read/reload and 198 KiB Unicode pagination pass; reader has no horizontal overflow at eight widths from 320–1440px. Live Google sign-in → authenticated text save → Firestore read → full refresh → Library return passed on 17 October with one explicitly labelled synthetic English/Odia text document. File-picker automation remains extension-permission-blocked; the updated material browser suite was not run. Earlier original-upload blockers below are historical for original files and do not prevent this text path.

Local links: **5193** labelled browser-only sample; **http://127.0.0.1:5194** connected build → new API **8001** using existing approved configuration in process environments. Original apps/servers are preserved. New API routes and unauthenticated 401 verified; real Google sign-in, text save and subsequent reads return successfully. No original/media upload or learning evidence was created. [Text content implementation, limits and integration handoff](../web/LIBRARY_TEXT_CONTENT.md).

Last completed: live Google → API → Firestore text persistence, full-refresh recovery and Library reopening verified with the labelled “Kiki Library verification — 17 Oct 2026” test entry. Proof is ignored under `test-results/document-text/live-saved-text.png`. Exact next: ordinary PDF/PPTX file-picker extraction/fidelity acceptance when browser upload access is available; actual parsers already pass unit tests. Feature remains local/uncommitted; no push/deployment performed.

## Completed

- **17 October — concept media (Arpan).** Read-only media delivery:
  - Optional `lesson.mediaExperience`, plus `GET /concepts/{id}/media` and `…/media/{revision}/assets/{assetId}`, gated by identity and enrollment.
  - Source-bound package building and create-only private assets behind an injected store.
  - One-transaction head switch (`scripts/publish_concept_media.py`, dry run by default).

  Media records sit beside catalog `am-51187527300cba2fa3cca868`, so learner state is unaffected. `KIKI_MEDIA_BUCKET` is unset and no storage exists yet, so connected lessons stay text-only. Covered by 9 tests in `tests/test_concept_media.py` and Python→React receipts. Details: [../web/CONCEPT_MEDIA.md](../web/CONCEPT_MEDIA.md).
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
