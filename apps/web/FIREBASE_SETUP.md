# Firebase Google sign-in and Python profile connection

Updated: 15 October 2026. [Current frontend status](active.md) · [Python API](../api/README.md).

## What is live now

The existing `builder-cup-a8479` web app uses Google-only Firebase Authentication. Google provider, public app name Kiki, support email and local domains were configured with user approval. Public web settings stay in ignored `.env.development.local`; no Admin credential or Analytics integration was added to React.

The user approved and created a Standard Native `(default)` Firestore database in **Mumbai / asia-south1**, with direct client access denied and no billing upgrade or paid backups. Database location is permanent.

`apps/api` now implements the small Python profile boundary. It verifies Firebase Google tokens (including project/signature/expiry and revoked/disabled accounts) and derives ownership from UID. Firestore transactions create a learner profile once, preserve preferences on return, save onboarding/preferences and enrollments, and preserve unrelated learner fields. A new student enters onboarding; a completed profile can return to Home. The exact live checks are recorded in active.md.

## Run both services

Python, from `apps/api`:

```sh
.venv/bin/uvicorn kiki_api.main:app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

Connected React, from `apps/web`:

```sh
npm exec --yes --package=node@24 -- npm run check:connected
npm exec --yes --package=node@24 -- npm run dev:connected -- --port 5174
```

Open **http://127.0.0.1:5174/auth**. `/connection` remains a development-only review separating Firebase identity from Python profile readiness. It never displays tokens or supplies a substitute profile. Both processes must be running. Configuration preflight alone does not prove backend availability.

The saved sample preview stays on **5173**, via `npm run dev`. It remains synthetic and browser-only. No sample material, preferences or quiz progress is automatically migrated into a real account.

## Server identity

The approved dedicated account is `kiki-profile-api@builder-cup-a8479.iam.gserviceaccount.com`. Its project roles are Firestore data read/write (`roles/datastore.user`) and Firebase Auth read (`roles/firebaseauth.viewer`). Akshita has token-creator permission on this specific service account. The Python Admin SDK uses impersonated ADC; no private service-account key was generated.

Google Cloud CLI and its local login/ADC files are isolated under ignored `apps/api/.tools/gcloud-config`, selected by API `.env.local`. The SDK loads that environment before initialization. The local helper login uses the approved user's existing Cloud permissions; the backend impersonates the more limited service account. Never copy `.tools`, credential contents or local env files to Git, a reference ZIP or the frontend.

The ordinary Firebase web key is not sufficient to authorize Admin/Firestore. Local server credentials and the web config are different. Python only exposes the UID-owned profile projection, not private SDK details or credentials.

## Current endpoints

[CONTRACTS.md](CONTRACTS.md) and [Python OpenAPI](../api/openapi.json) cover bootstrap, profile GET/PATCH and enrollment. Responses retain `{ profile }`, `profile/v1`, numeric onboarding steps and self-confidence ratings. Completion time is server-normalized; a stale draft cannot reset completed onboarding. Confidence is never mastery. Configure exact CORS origins on the server; current local origins are 127.0.0.1:5174 and localhost:5174.

Uploads, assessment evaluation and lab/content APIs are **separate pending backend slices**. Profile API availability does not imply those adapters are connected. No mock answers or file-processing jobs are returned in connected mode. Arpan is still preparing the map/lesson modules.

## Library storage

| Item | Current 5173 preview | Connected target |
|---|---|---|
| Identity/profile | Browser sample data | Firebase Auth plus UID-owned Firestore profile through Python (now implemented) |
| Original PDF/images | Browser IndexedDB, `kiki-material-preview-v1` | Private Firebase Storage, upload adapter still pending |
| Request/file/processing records | Browser IndexedDB | Firestore through Python intake API, still pending |
| OCR/outline/lessons | Explicit sample controls | Real Python jobs and reviewed generated content, still pending |

A supplied Storage bucket name does not demonstrate bucket creation, billing readiness or working uploads. Storage setup is outside this profile step. Signing in does not move existing browser files into Firebase.

## Verification boundaries

Backend pytest uses test-only identity/Firestore doubles to check ownership, validation, repeat-safe creation, completed-profile preservation, semester/enrollment persistence, CORS and unavailable-service failures. Live checks separately cover Google identity → Python verification → Firestore profile, onboarding save/reload and returning-user routing. Real multi-account browser denial, IAM/transaction contention, physical phones, redirect/personal-device persistence and cloud uploads remain separate acceptance gates.

References: [Firebase verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [ADC setup](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment), [redirect setup](https://firebase.google.com/docs/auth/web/redirect-best-practices).

## Upload / Library connection — 15 October

The Python endpoints are implemented and the real signed-in Library list can read Firestore. Original upload/view/download is tested with doubles, **not yet live**: project billing is disabled and the default Storage bucket is absent. See [the concrete setup and remaining approval](../api/STORAGE_SETUP.md). Do not place file bytes in Firestore or make a public bucket to bypass this. Existing sample files stay in browser-only IndexedDB.
