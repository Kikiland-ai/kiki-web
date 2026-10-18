# Local lab screen-sharing integration

**Merged, 18 October:** the implementation is on `main` as PR #7 (`0ee6646`, merge `0ed7c06`). The kiki-backend code it calls is on kiki-backend `main` (its PR #3); the backend branches named in older notes were deleted after that merge. Open items by owner are in the [kiki-backend lab handoff §0](https://github.com/Kikiland-ai/kiki-backend/blob/main/docs/handoffs/kiki-web-lab-mode-screen-share.md); testing across machines (SSH forward, ngrok or Tailscale) is in [connected integration testing](https://github.com/Kikiland-ai/kiki-backend/blob/main/docs/plans/connected-integration-testing.md).

18 October 2026. Implementation branch: `feature/lab-screen-share-implementation`, based on PR #6 `29724c7` / main `93cce9b`. The user authorized commit and push of this separate implementation branch on18 October. This source publication does not update PR #6, merge into main or deploy the application.

The user confirmed Aditya's approval and explicitly chose local operation. Production origin/hosting (B1) and hosted upstream (B2) remain deferred. This extends saved preparation without changing its URL, notes, readiness, theory marks or practical assessment. Screen-inferred action tracking never grants assessed practical proficiency; `pointerActive` remains false.

## What changed

- `apps/api` verifies Firebase Google identity, enrollment and preparation ownership before a fixed upstream allowlist. Browser traffic goes only to this API. Owner/proxy headers are generated on the server, client headers/cookies are not forwarded, redirects are refused, requests/images/streams are bounded and streams stay incremental.
- A transaction reserves `learners/{uid}/labExecutions/{prepId}` before the first upstream create. A stable operation key is sent as `Idempotency-Key`. Screen sessions are registered against that owned preparation. No pixels, Firebase tokens or observation evidence are stored in this link.
- WebSockets use a signed, single-use, 60-second opening ticket. The Firebase token stays in worker memory; the relay verifies it on opening and every five seconds, checks Origin explicitly and closes on lost enrollment/ownership/revocation. The opening URL is removed from ASGI's query string before acceptance logging.
- Connected Lab mode has an Engineering Sketchbook panel to bind the extension, share the correct Chrome tab, pause/resume, stop and reconnect. A new Share gesture is required after a disconnect, reload or sign-out. Saved notes remain independent.
- A copied canvas is limited to 1600px, masked with neutral rectangles before JPEG encoding and sampled about every two seconds. Wrong handles/origins, non-tab capture, stale/moving/missing geometry and mismatched aspect ratios block encoding, upload and analysis. Recent rectangle positions are retained for 1.5 seconds with 16px padding.
- The TypeScript projector/publisher retain `floating-guidance/v0.1`. The page and windows use the same authoritative Now/Next projection. Only validated `guidance_committed` events update a streamed decision; provisional prose stays a preview and late auxiliary packets cannot roll it back. Provider backoff is respected.

## Python compatibility findings

Pinned reference: `Kikiland-ai/kiki-backend` commit `73c6e96ab876ad3a400e76110bcf4abac9dbce60`, originally on branch `experiment/floating-guidance-bubbles` and now part of kiki-backend `main`. Nothing kiki-web calls has changed on kiki-backend `main` since that commit.

Python has record-shaped `steps`, `capture_status` rather than `capture_active` in full states, seconds in frame timestamps, and an unlimited (`null`) capture-session duration. The bounded committed projection omits capture status. These differences are normalized in `src/contracts/lab-execution.ts`, with receipts produced by the actual Python offline pipeline. Object property ordering is ignored when checking equivalent decisions; array ordering remains significant.

The receiver must acknowledge `capture_started` before Python permits `/attach`. Pause/resume also changes Python's revision, so capture acknowledgements and fresh state reads coordinate the two controls. This is exercised against the actual Python service, not only a fake relay.

**Create retry:** the reservation saves its operation key and the create body's `modelName`. When a reservation is still `creating` (for example, the first response was lost), the next start repeats `POST /lab-sessions` with the same key and the same body, then links the returned lab. This requires kiki-backend `main` with idempotent lab creation: the same owner, key and body replay the original lab, and a different body gets 409. Against an upstream that ignores `Idempotency-Key`, a retry could create a second lab, so deploy that backend first. Reservations made before `modelName` was saved are never re-posted; they stay `creating` and return 503 until reconciled manually. A linked reservation only reads.

**Local concurrency:** one API worker owns opening tickets in memory. An API restart or another worker rejects unknown tickets safely; reopen through Lab mode. Shared atomic ticket storage or explicit routing is required before multi-worker hosting. Monitoring cached as active expires conservatively after20s without a state read. There are at most20 capture sessions per preparation in this slice.

## Local setup

Use Node24.12+, Python3.12 and committed npm/uv locks. Keep existing Firebase settings, credentials and proxy secrets outside Git. No cloud import, IAM, Storage, billing or deployment is required.

1. Run the approved backend checkout at `http://127.0.0.1:8100`. Configure its server-only `KIKI_PROXY_SECRET` and `KIKI_REQUIRE_PROXY=1`; a real analyzer needs the backend owner's provider configuration.
2. In `apps/api` set `KIKI_LAB_EXECUTION_MODE=local`, `KIKI_LAB_BACKEND_ORIGIN=http://127.0.0.1:8100` and `KIKI_LAB_PROXY_SECRET` to the same secret (32–256 characters). Keep normal Firebase verification and course enrollment; there is no connected-mode auth bypass. Use one API worker, allow `http://127.0.0.1:5174` in `KIKI_CORS_ORIGINS`, and point `VITE_API_BASE_URL` to this API's local port.
3. Run `npm run dev:connected -- --port 5174` in `apps/web`. Load the development extension built for that exact reader origin. The upstream release builder does not yet allow5174, so the local test builder below adds it in an ignored artifact; a distributable extension still belongs to the backend owner.
4. In a saved preparation open MATLAB, explicitly choose **Show Kiki on this tab** in the extension, return to Lab mode and choose **Share your MATLAB tab**. Select that same Chrome tab, never the entire desktop. A cancelled picker leaves notes and the session intact.

The feature defaults to `disabled` on the API. With an unavailable backend the panel offers recovery and preserves preparation; it never substitutes fixture guidance in connected mode. Normal browser-only fixtures retain manual preparation.

## Reproducible offline acceptance

No real account, cloud writes, MATLAB account or Gemini request is used. The executable under `apps/api/tests/lab_screen_share_server.py` injects a test verifier and transactional in-memory Firestore double only into that test process. It runs the actual Python backend with `JsonStreamingAnalyzer` over an HTTPX `MockTransport`. The React test entry exists only under `tests`; the production entry cannot import it.

From `apps/web`, set `KIKI_BACKEND_CHECKOUT` to the pinned checkout, then:

```sh
node scripts/build-lab-test-extension.mjs
npx playwright install chromium
npx playwright test -c playwright.lab.config.ts
```

Ports5174 (React),8002 (test API),8100 (actual upstream) and8871 (controlled target) must be free; the test refuses reuse of unrelated servers. The test browser has its own temporary profile, native tab capture and the real development extension. Its loopback permission is granted only in that profile. The controlled target has a visible magenta extension canary; model-bound JPEGs must contain grey masks and no canary pixels. Output stays in ignored `test-results`/`test-artifacts`.

Regenerate the synthetic Python→React receipt from repository root:

```sh
KIKI_BACKEND_CHECKOUT=/path/to/kiki-backend apps/api/.venv/bin/python apps/api/scripts/export_lab_execution_receipt.py
```

The generated committed fixture contains unknown findings and no images, learners or credentials. It proves contract compatibility, not visual accuracy or assessed success.

## Acceptance still outside this local slice

A student-controlled MATLAB Online trial with the distributable extension and the backend owner's real analyzer remains necessary to establish actual screen-reading quality and MathWorks behavior. Production origins, HTTPS/SPA hosting, extension release allowlists, provider configuration, persistent upstream hosting and multi-worker ticket/idempotency recovery remain separate. Do not infer those from passing offline tests.

## Verification result

Final local source checks:180 frontend tests (37 files),118 API tests, ESLint, TypeScript/production build, Ruff/format, OpenAPI and existing Python→React contracts pass. The expanded real-extension/native-capture/Python fake-analyzer test passes, including a committed change of procedure action, plus eight existing saved-preparation browser regressions. It also checks positive/negative pixel-canary controls, pause from both sides, provider waiting, Stop/reconnect, target/page reload, sign-out and responsive layout. No practical criterion or score is granted. Test servers/profile are cleaned up; older previews remain untouched. Source/production exclusion checks pass. A real Google/Firestore/Matlab/Gemini trial is not claimed.
