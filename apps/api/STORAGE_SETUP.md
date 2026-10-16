# Private cloud originals — setup and acceptance

15 October 2026 · Implementation ready locally; cloud Storage is **not active**.

**User decision:** no payments or Firebase billing upgrade. The Blaze/new-bucket proposal below is historical and NOT authorized. User proposes a colleague’s existing Storage; identify its project/bucket and approved server access while preserving current Auth/Firestore. No local alternative was activated.

## Current evidence and required decision

Read-only Google Cloud checks show `billingEnabled=false`; `builder-cup-a8479.firebasestorage.app` returns bucket-not-found. The existing web config's bucket name does not provision a bucket. [Firebase requires Blaze for Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024). The previous database approval excluded billing upgrades, so none was applied here.

Reviewable proposed setup:

1. User chooses/links a billing account and upgrades **builder-cup-a8479** to **Blaze**. This enables pay-as-you-go charges for project usage; a budget alert is not a spending cap. No promise of free usage. Payment details and any billing agreement are the user's step.
2. Create the Firebase default bucket **builder-cup-a8479.firebasestorage.app**, Standard regional storage in **Mumbai / asia-south1** (same region as Firestore), with private production rules. Location is a lasting choice. No optional paid backup/replication feature is requested.
3. Use uniform bucket-level access and enforced public-access prevention. Keep Firebase client reads/writes denied. No public ACLs, download tokens or signed public links.
4. Grant existing **kiki-profile-api@builder-cup-a8479.iam.gserviceaccount.com** only bucket-level **roles/storage.objectCreator** and **roles/storage.objectViewer**. Existing Firestore/Auth roles and user impersonation scope stay as approved. No project-wide Storage Admin role or private key. These new bucket permissions require approval before being applied.
5. Set the ignored API `.env.local` variable `KIKI_STORAGE_BUCKET=builder-cup-a8479.firebasestorage.app`, restart Python, verify with actual signed-in upload/retrieval. No browser Admin/Storage credentials.

Do not execute step 2/4 before the billing/location/access decision is approved. Firebase may provision its own service agent for bucket/rules integration; inspect unexpected additional permission prompts rather than granting new unrelated access.

## Implemented path

React → bearer-authenticated Python API → verified Google UID → Firestore receipt metadata + private originals via Firebase Admin's Cloud Storage bucket interface. Direct browser Firestore/Storage rules remain deny-all. Storage IAM is enforced for the API; ownership is enforced again on every Python endpoint.

- `POST /study-requests`: multipart `context` JSON + 1–5 original PDF/JPEG/PNG files, max 10 MiB each. Required `Idempotency-Key`, 8–200 ASCII letters/digits/underscore/hyphen. Calendar/subject/enrollment/input checks; actual PDF/image validation (no encrypted PDFs; max 500 pages/40 MP images).
- `GET /study-requests?cursor=...&page_size=25`: owner-scoped descending pages; max page size 100, `nextCursor`. UI loads 25 records and offers **Load more material**. **Refresh Library** returns to newest page. No polling on `stored` receipts.
- `GET /study-requests/{id}`, `GET /source-docs/{id}`: authorized metadata. Unknown/foreign ID returns 404. No object path or generation in the public projection.
- `GET /source-docs/{id}/content`: independently authorizes source and parent, pins stored object generation and verifies MIME/size/SHA256; returns private/no-store binary. Browser uses revocable local blob URLs for view/download.
- Confirm/retry processing routes return 409 until actual extraction/generation exists; no fabricated outline or lesson.

## Persisted state and recovery

All Firestore documents below are under `learners/{verifiedUid}`:

| Collection | Purpose |
|---|---|
| `uploadOperations/{requestId}` | Canonical payload/byte fingerprint, reservation timestamp, receiving/stored status |
| `studyRequests/{requestId}` | Public `intake-view/v1` receipt after all originals are present |
| `sourceDocs/{sourceId}` | Public source fields + internal immutable generation |
| `intakeJobs/{requestId}` | Durable `waiting_for_processor` record; no worker is claimed |

Object path: `learners/{uid}/requests/{requestId}/{sourceId}`. IDs derive from owner + upload operation key; source IDs additionally include file order. Titles are metadata, not path components. Objects use generation-match-zero creation and SHA256 metadata, with no overwrites/deletes or permanent public URLs. Original writes happen before a single Firestore transaction publishes receipt/source/job records.

An uncertain object write/metadata commit may leave incomplete reserved originals. Retry the exact same payload/key to recover; changed payload with that key returns 409. Do not delete partial objects on uncertain failure, because another retry may have committed. A future explicitly reviewed retention/cleanup policy is needed before wider release; abandoned partial objects can consume storage. Browser reload before receipt still requires checking Library/reselecting files; this is not resumable chunk/offline upload.

No migration of sample IndexedDB files, no proficiency award, no existing profile field changes. Parser limits are not antivirus scanning; malware scanning/async document sandbox and per-account aggregate quotas/rate limits remain production release work. API body bytes are bounded even without Content-Length; malformed multipart files are closed by Starlette's parser and form context.

## Checks and remaining live gate

40 Python tests: 17 existing profile + 23 material cases. Storage/Firestore doubles cover byte retrieval, repeat-safe recovery, changed payload rejection, cross-user isolation, dates/file format/count/size, enrollment, deferred status, paging and corrupted bytes. These do not prove Google Cloud IAM, concurrency or live Storage.

59 frontend unit/component/transport tests, 37 preview browser tests (including 320–1440px material layouts), lint/typecheck/production build pass. Connected Library list was loaded with the existing real Google identity against Python/Firestore after restart; it correctly returned an empty Library. This does not prove an original was uploaded.

After cloud approval/setup: choose a deliberately non-sensitive PDF + image; enroll Analog Communication if needed; upload → `Saved in Library`; open/download originals; verify exact hashes; reload Library; sign out/sign in and reopen; verify a second account cannot retrieve the source/content (requires a second account). Check private rules/public-access prevention and scoped API IAM. Do not describe this slice as cloud-complete until these checks run.

References: [Admin Storage](https://firebase.google.com/docs/storage/admin/start), [generation preconditions](https://cloud.google.com/storage/docs/request-preconditions), [Python Blob API](https://docs.cloud.google.com/python/docs/reference/storage/latest/google.cloud.storage.blob.Blob).
