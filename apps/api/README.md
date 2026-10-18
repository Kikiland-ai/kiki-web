# Kiki Python API

This is the minimal Python service requested on 15 October 2026: Firebase Google identity → verified token → Firestore profile → React onboarding/Home. See [active.md](active.md) for actual completion and remaining cloud setup. It is independently movable into the team's eventual backend checkout; the older `tools/backend-starter` is not its runtime.

## Run locally

Python 3.12 and locked dependencies:

```sh
uv sync --locked --python 3.12
cp .env.example .env.local
uv run uvicorn kiki_api.main:app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

Do not overwrite an existing `.env.local`. In this workspace, Python 3.12.15 and the virtual environment have been prepared. The original global `python3` remains 3.9. Prepared tools are ignored under `.tools/`; use `.tools/uv` if uv is not on PATH, or invoke `.venv/bin/uvicorn` directly. No credentials are bundled or printed.

The separate web connected review stays on http://127.0.0.1:5174. The saved fixture preview stays on 5173. `/health` is **liveness**, not proof that Google verification/Firestore works. `/docs` and `/openapi.json` expose the profile, material, learning and assessment contracts. Starting an API does not create a cloud database or server credentials.

## Server identity and database

The real project is `builder-cup-a8479`; the frontend public web API key cannot authorize the Admin SDK. Use an existing server workload/service-account identity or approved local Application Default Credentials (ADC). Google Cloud CLI is prepared from the official ARM64 archive under `.tools/google-cloud-sdk`, with its official SHA256 checked. It has not changed shell PATH. The user approved Cloud SDK authentication and the dedicated keyless account; local credentials are isolated under `.tools/gcloud-config`, and the service account has only `roles/datastore.user` and `roles/firebaseauth.viewer`. The user has token-creator permission on that account, not a new project-wide token-creator grant.

Local ADC setup uses Google's browser authorization and saves a local credential file through the CLI. This grants the local SDK the selected Google identity's existing Cloud permissions; it is not restricted to this project by OAuth scope alone. Do not create/commit a long-lived service-account key or grant a new IAM role without an explicit decision. The configured ADC impersonates `kiki-profile-api@builder-cup-a8479.iam.gserviceaccount.com`, avoiding unsupported plain gcloud-user credentials for Firebase Auth. No private key was generated. `.env.local` is loaded before SDK initialization so its isolated Cloud SDK path and emulator variables apply consistently.

After approved credential setup, run:

```sh
.venv/bin/python scripts/check_connection.py
```

This uses SDK credentials normally to read a nonexistent connection-probe path; it makes no writes and prints no credentials or learner data. A passed probe proves Firestore access only. Real Firebase-token verification and a browser round trip remain separate checks.

Firestore must have a Standard Native `(default)` database. The prepared console proposal is Mumbai (`asia-south1`), with production-mode client rules denying all direct reads/writes and no paid backups/billing upgrade. The user approved that location and private setup, and database creation is complete. No billing upgrade or backup was enabled. The Admin SDK uses IAM and Python checks, so it does not need permissive client rules. No rules are loosened by this API.

Cloud mode refuses Firebase emulator variables. Emulator mode requires `KIKI_ENVIRONMENT=emulator`, project `demo-kiki-local` and both localhost Auth/Firestore SDK hosts. There is no production fixture or skip-auth mode. Tests inject doubles only inside pytest.

## Implemented boundary

| Method | Path | Behavior |
|---|---|---|
| GET | `/health` | Process liveness only |
| POST | `/learners/me/bootstrap` | Verify Google bearer token; atomically create profile once or return existing profile |
| GET | `/learners/me/profile` | Return only the verified UID's profile |
| PATCH | `/learners/me/profile` | Allowlisted language/dial/onboarding update |
| POST | `/learners/me/enrollments` | Add unique supported course and persist semester |

All profile responses use `{ "profile": ... }`, schema `profile/v1`. These mirror [the web contract](../web/CONTRACTS.md) and [profile.ts](../web/src/contracts/profile.ts). New students start with incomplete onboarding. Returning students retain saved preferences/completion. Completion is normalized to server time, and stale drafts cannot reset completed onboarding. Confidence is a self-rating, never a proficiency score.

Firebase Admin verifies signature/project/expiry and checks revoked/disabled accounts (`check_revoked=True`). Only Google-provider identities are accepted. Ownership comes exclusively from verified UID, never request fields. Invalid/missing identity is 401; unsupported provider 403; missing profile 404; stale completion reset 409; invalid fields 422; unavailable credentials/storage/compatibility 503. API responses/logs exclude SDK error details, credential values and stored learner documents.

Storage:

- `learners/{verifiedUid}` holds the additive profile projection plus created/updated server timestamps. Existing unrelated learner fields are preserved.
- `learners/{verifiedUid}/enrollments/{courseId}` stores semester and update time. Unique course membership and the enrollment record commit in one transaction.
- All creation/updates/enrollment use Firestore transactions, with SDK retries on contention. Never reset an incompatible existing document to defaults. No direct client Firestore write is introduced.

The upload/Library boundary is now implemented locally; see [STORAGE_SETUP.md](STORAGE_SETUP.md) for exact endpoints, private storage, retries and remaining cloud setup. The real signed-in Library list reads Firestore. Real cloud originals await Blaze/bucket/IAM approval and acceptance. Learning content, positions, assessments and map progress are now implemented; see [LEARNING_STORAGE.md](LEARNING_STORAGE.md). Speech, pointer and lab endpoints remain pending. No synthetic records hide missing integrations.

## Public contract

`openapi.json` is exported from the actual FastAPI routes/schemas. Regenerate with `.venv/bin/python scripts/export_openapi.py`; it does not authenticate or read student records. Keep the existing frontend profile projection aligned when changing it.

## Checks and acceptance

```sh
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/pytest -q
```

Pytest uses FastAPI's actual routes with a test-only Firestore/identity double to check ownership, validation, stable bootstrap, onboarding/resume, immutable completion, enrollment, CORS, SDK verification invocation and unavailable dependency handling. It does **not** prove real IAM, certificate verification, Firestore transaction contention or cloud persistence.

Live acceptance: database + server credentials ready → Google sign-in on 5174 → Python verifies token and returns matching UID profile → onboarding saves each step → refresh resumes → complete → Home → sign out/re-sign-in → same profile/Home. Also verify another account cannot access that profile. Keep real-account changes deliberate; never clear a real student's onboarding to manufacture a new-user test.

References: [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [local ADC](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment).

## Actual acceptance — 15 October 2026

17 Python API checks and Ruff lint/format pass. Live Firestore read access and forged-token 401 checked; genuine Google sign-in loaded/created the UID-owned profile, resumed a saved onboarding step after reload, completed to Home, and returned directly to Home after sign-out/sign-in. The default test preferences are editable in Profile. API and connected UI are left running; the live browser is at Home. Enrollment is implemented/unit-tested but not changed on the real student account during this check.

## Upload / Library slice — 15 October

Private upload/list/request/source/content and closed confirm/retry boundaries are implemented. The API remains running on 8000 with profile access intact. 40 Python tests pass. No billing upgrade/bucket/Storage IAM change has been made; uploads explicitly fail until those prerequisites are configured. See [STORAGE_SETUP.md](STORAGE_SETUP.md) before cloud setup.

## Firestore learning slice — 15 October

Versioned source catalog imported (68 content documents plus head; no seeds). Python now serves authenticated chapter/lesson, owned positions, immutable assignments, revisioned drafts, authoritative results and a shared progress projection. See [LEARNING_STORAGE.md](LEARNING_STORAGE.md) for data paths, dry-run/apply/update commands, history bounds, rollback and verification. No billing or Storage change is required for this text catalog.

## Lab preparation — 16 October

Preparation-only practical/start/active/get/revisioned PATCH routes are implemented and exported in OpenAPI. See [the lab boundary](../web/LAB_PREPARATION_CONTRACT.md) for Firestore paths, drafts, owned locator links and Aditya’s deferred monitoring/assessment integration. 78 Python tests pass; no preparation operation changes practical proficiency or trusted experiment evidence.

## Optional local lab execution

`KIKI_LAB_EXECUTION_MODE` defaults to `disabled`. For the approved local screen-guidance path, configure the exact upstream origin and server-only shared secret as described in [the integration handoff](../web/LAB_SCREEN_SHARE_IMPLEMENTATION.md). The existing Firebase identity, enrollment and preparation ownership checks remain mandatory. Use one API worker for local opening tickets. Ambiguous upstream-create failure is held for reconciliation because the pinned upstream lacks durable idempotency replay. No assessment or practical grade is awarded by this integration.
