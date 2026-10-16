# Material intake / Library v1 — Python upload/Library contract

15 October 2026 · Python upload/list/get/source/content implemented and tested locally. Live cloud originals await billing/bucket/IAM approval. Real processing remains pending. See [Storage setup](../api/STORAGE_SETUP.md).

The new slice follows [journey step 4](../../docs/ux/student-journey-odia-ece.md) and implementation-plan Phase 3. Types and runtime validation live in `src/contracts/intake.ts`. This is a view projection of `StudyRequest`, `SourceDoc` and `GenerationJob`, not a replacement for the existing full domain models. Frontend interfaces live in `src/contracts/services.ts`; `Services.intake` is wired in both modes. Review/mirror these shapes in Python and generate the agreed schema before integrated acceptance.

## Routes and UX

- `/subjects/CRS-AC-ECE/material?kind=syllabus|notes|experiment_sheet`: form; topic, optional class date/note, one to five PDF/JPEG/PNG files, maximum 10 MB each.
- `/intake/:requestId`: durable request status, original-source links, editable outline, confirm/retry and eventual chapter entry.
- `/library`: received requests and original-file links; status survives return and refresh. Connected lists use cursor pages (25 records) and Load more material; Refresh Library returns to the newest page.
- `/library/:sourceId`: authenticated original-file retrieval, temporary browser blob URL, inline view/download. URLs are revoked when the viewer unmounts/signs out; there is no permanent public private-file link.
- Home shows up to three recent received requests and upload activity. Adding material does not mutate learner scores or erase enrollment/progress.

## Transport

Every call uses a Firebase bearer token. Derive UID on the server and authorize each request/source/job; the browser does not supply ownership. Retried mutations send the same `Idempotency-Key` for one logical attempt; use owner + operation + key and validate payload consistency. Bootstrap/profile routes remain unchanged. `VITE_API_BASE_URL` may include the selected version prefix.

| Endpoint | Input | Output |
|---|---|---|
| `POST /study-requests` | Multipart: `context` JSON `{courseId, kind, topic, note, classDate}`, repeated `files` parts | `{request: IntakeRequest}`; persist originals/request/deferred job before responding |
| `GET /study-requests` | Optional `cursor`, `page_size` (1–100; default 25) | `{requests: IntakeRequest[], nextCursor: string|null}` scoped to current UID |
| `GET /study-requests/{id}` | No body | `{request}` |
| `POST /study-requests/{id}/confirm` | `{outline}` | `{request}`; currently 409 after ownership check; actual processing worker not available |
| `POST /study-requests/{id}/retry` | `{}` | `{request}`; currently 409 after ownership check; actual processing worker not available |
| `GET /source-docs/{id}` | No body | `{source: SourceAsset}` with owner, parent request, title, MIME, size and createdAt |
| `GET /source-docs/{id}/content` | No body | Original binary with exact MIME/size; authorize independently of metadata fetch |

Use exact CORS for the local frontend; allow Authorization, Content-Type and Idempotency-Key. Do not set the multipart Content-Type manually in the browser. Requests have a 60-second deadline; retry after an uncertain upload must not create duplicate jobs. Persist originals in private Firebase Storage, records/jobs in Firestore via the Python owner. Keep deny-all client rules under this API-only model.

## Request projection

Required fields: `schema: "intake-view/v1"`, `id`, `ownerLearnerId`, `courseId`, `kind`, `topic`, `note`, `classDate`, `status`, `sources`, `outline`, `jobId`, `lessonPlanId`, `failure`, `createdAt`, `updatedAt`. See Zod schemas for exact shapes. Empty optional class date is `""`; real API validates actual calendar dates, topic/note bounds and allowed kinds. `outline`, `lessonPlanId` and `failure` use explicit null until available.

- Status: `stored` means originals saved and processing deferred. A real future worker can advance `reading → needs_review → generating → ready`, or `failed` with `{message, canRetry}`. Upload activity is a client transport state before the server receipt, not a fabricated processing percentage.
- `outline`: title, provisional flag, ordered concepts `{id,title,included}`, linked source IDs and exclusions. Require unique concept/source IDs, matching source ownership and valid source refs. A ready record requires its actual lessonPlanId; never substitute an unrelated chapter when it is missing.
- Read source pages for genuine extraction/page counts; do not infer a PDF page count from file size. Recognize unreadable pages and preserve valid attachments on partial failure. Supported-type/header checks in the browser are convenience validation; the server must inspect actual content and enforce extraction limits.
- Correct/version-normalize timestamps server-side. Reject invalid stages/transitions, foreign records, unavailable source refs and forged readiness. API workers own parsing/generation; frontend controls do not change authoritative job state.

The client uses cancellable cursor pages and visible errors. It polls every five seconds only while a real reading/generating stage is present; stored originals do not trigger polling. Preserve server revisions/ordering when extending processing. A refresh after receiving a request can retrieve durable job state. Browser-upload cancellation does not imply cancellation of a server job; no server-job cancellation endpoint is claimed here.

## What the local preview really does

`src/fixtures/intake.ts` and `material-store.ts` save **actual selected file bytes** and synthetic request records in IndexedDB. This is browser-only preview storage, not Firebase. Byte hashes and a stable request ID protect retries of the same upload key; changed details for that key are rejected. Metadata/blob writes are one transaction. Another learner cannot retrieve the fixture's records through its adapter. The synthetic student can reopen this browser's saved originals after sign-out/sign-in; they are not synchronized to another device.

No reading or generation runs. **Preview sample outline**, **Preview reading failure** and **Preview ready state** explicitly select fixture states. The outline is copied from the reviewed-case draft's concept names and clearly labelled as not extracted from the uploaded file. Confirming it saves user edits, without creating real lessons or changing the content ledger. These controls and fixtures are excluded from connected production adapters. No timer claims processing success.

Files remain selected if a create request fails in the active form. Background upload is held by the signed-in material provider so navigating within Kiki does not silently cancel it; Home/Library expose the activity. A full browser reload before an upload receipt may lose unsaved file selection: reselect the files and check Library for an already received request. This slice does not claim reload-safe in-flight uploads, offline cloud syncing or resumable chunk transport.

## Remaining live gate

Live Storage bucket/billing/IAM and real upload/retrieval acceptance remain pending. Python ownership/idempotency/validation tests pass using doubles. Actual extraction/outline/lesson generation, real phone camera/file-picker/keyboard checks and source-backed lesson composition remain pending. Unit/fixture checks do not pass these live gates.
