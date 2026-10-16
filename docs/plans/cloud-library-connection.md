# Private uploads and Library connection

Status: Active
Last updated: 2026-10-15
Current phase: code/checks complete; no payments authorized; identify colleague’s existing Storage

## Objective and success

Connect the existing React material form and Library through Python to private originals in Firebase Storage and UID-owned Firestore metadata. Success is one upload receipt, original view/download, persistence after reload/sign-in, owner isolation and repeat-safe retries. Storage success must not claim OCR or lesson generation.

## Context and scope

User: “can we do the firebase connections to the upload and getting the files in library”. Existing Google/profile connection works. Inspect `apps/web/INTAKE_CONTRACT.md`, `src/contracts/intake.ts`, `src/services/intake-http.ts`, material/Library features, and `apps/api`. Use BB8 implementation guidance in reference mode. Arpan's learning modules are outside this change.

## Decisions and current evidence

- Verified cloud billing disabled and the configured default Storage bucket absent (read-only CLI checks, 15 October).
- Firebase documentation requires Blaze for Storage. Prior user approval explicitly excluded a billing upgrade; no billing or Storage IAM changes made here.
- Keep private API-only file access, verified Google UID, exact CORS, no permanent public download URL.
- New `stored` status means originals saved; a durable job is deferred until a real processor exists. No fake reading progress.
- No migration of browser-only sample originals. Existing profile records and unrelated work remain untouched.

## Workstreams / Now, Next, Later

- Now: implement bounded validated multipart upload, deterministic owner/key reservation, create-only private objects, atomic request/source/job metadata, owned list/get/content and safe error states. Verify with storage/Firestore doubles and React checks.
- Next: present exact cloud setup for approval (Blaze billing, Mumbai bucket, private access, bucket-only object create/read for existing API account). After approval, run live Google → upload → reload Library → original bytes checks.
- Later: real OCR/outline generation, authoritative assessments, Arpan map/lesson integration. Deployment and commit/push are separate instructions.

## Risks and controls

- Cross-service failure: stable request/source IDs, payload fingerprint reservation, create-only object writes, commit receipt after all originals; exact retry resumes incomplete upload without duplicate request. Incomplete reservations/originals retained for recovery; cleanup policy still pending.
- Malformed/large upload: bounded body, at most five files and 10 MiB each, verified PDF/image format, image pixel/PDF-page limits, no parsing/extraction claims.
- Cross-account access: records and objects resolved under verified UID; unavailable storage returns explicit errors, no fixture fallback.
- Original retrieval: authorization on every request, private/no-store response, verify bytes against hash/metadata before delivery.

## Cold-pickup handoff

Last completed: implemented Python/React upload/Library connection, generated OpenAPI, passed 40 Python + 59 frontend + 37 preview browser checks; verified real Library list; saved Firebase console billing-requirement screenshot.
Exact next action: user billing/setup decision using apps/api/STORAGE_SETUP.md; user completes billing/payment, then private bucket and approved bucket-scoped API IAM, configure server setting, restart and verify actual original bytes. No cloud upload has run.
Do not repeat: Google sign-in/profile setup or service-account creation. Do not read/print ADC contents.

## Verification and handoff (15 October)

Local checks passed: 40 Python (23 material + 17 profile), 59 frontend unit/component, 37 preview browser checks, Ruff/ESLint/TypeScript/build, updated public OpenAPI. Signed-in real Library list loaded from Python/Firestore. Current cloud gate is confirmed both by CLI and visible Firebase Storage screen. No upgrade/bucket/IAM change was applied. See apps/api/STORAGE_SETUP.md for recoverable partial uploads, private defaults and remaining release limitations.

## Latest steering (15 October)

User explicitly declined all Firebase storage payments/billing upgrades, then proposed a colleague’s existing Firebase Storage. Do not execute the earlier billing/new-bucket proposal. Next: clarify project ID and bucket, preserve current Google Auth/Firestore, verify usable existing Storage and minimal authorized Python access. API key belongs in apps/web/.env.development.local and is already configured for current login; a different project needs matching configuration and server authorization. A local disk alternative was drafted but not activated and was removed when the user supplied the colleague-project direction.
