# Lab mode screen sharing — kiki-web plan

18 October 2026 · Original PR #6 was plan-only; local implementation is now on `feature/lab-screen-share-implementation`. See [implementation, verification and limits](LAB_SCREEN_SHARE_IMPLEMENTATION.md). The user authorized commit and push on the separate implementation branch; PR #6 and main remain unchanged.

The student should start, see and control MATLAB/Simulink Online screen sharing from **Lab mode** (`/labs/:sessionId`), not from kiki-backend's demo reader page. Kiki's floating windows on the MATLAB tab, already working in kiki-backend with live Gemini reads, follow this page instead. This file lists **only the kiki-web work**; the other owners' parts are dependencies (§5).

Source handoff, decisions and reference code live in kiki-backend on branch `experiment/floating-guidance-bubbles`:

- [Handoff](https://github.com/Kikiland-ai/kiki-backend/blob/experiment/floating-guidance-bubbles/docs/handoffs/kiki-web-lab-mode-screen-share.md)
- [ADR 0010 — kiki-web's API fronts lab execution](https://github.com/Kikiland-ai/kiki-backend/blob/experiment/floating-guidance-bubbles/docs/decisions/0010-kiki-web-api-fronts-lab-execution.md)
- [ADR 0009 — keep Kiki's windows out of screen reads](https://github.com/Kikiland-ai/kiki-backend/blob/experiment/floating-guidance-bubbles/docs/decisions/0009-floating-window-capture-redaction.md)

## 1. Decisions (Arpan, 18 October)

- **The browser talks only to `apps/api`.** It verifies the Firebase token, enrollment and ownership of the `prep-*` preparation, then forwards a fixed allowlist of lab-execution calls to kiki-backend's Python service as a trusted upstream.
- **This work starts from `main`** (`93cce9b`).
- **Historical plan authorship:** Arpan requested `arpanvihan5-sketch` for his commits. This is source context, not an instruction to impersonate him; the current implementation has no new commits. Any later publication follows the current user authorization and applicable repository identity instructions.
- **The production web address is deferred under B1** (§2).

The user confirmed Aditya's agreement (B3) and chose local operation. [LAB_PREPARATION_CONTRACT.md](LAB_PREPARATION_CONTRACT.md) now records the approved optional execution path and matching monitoring enum. Assessment and pointer integration remain deferred.

## 2. Blockers

| ID | Item | Owner | Effect until resolved |
| --- | --- | --- | --- |
| **B1 (high priority, this repo)** | Production origin and hosting for kiki-web: HTTPS URL, SPA fallback ([README](README.md)), deploy target | Arpan / Akshita | Build and test on `http://127.0.0.1:5174` only. The origin is needed for `KIKI_CORS_ORIGINS`, the WebSocket Origin check, and the extension allowlist in kiki-backend |
| B2 | Hosted kiki-backend Python service: persistent, HTTPS, proxy secret, Gemini key | Arpan (kiki-backend) | Use a local upstream on `127.0.0.1:8100` |
| B3 resolved | User confirmed Aditya approved this approach | Arpan / Aditya | Local implementation authorized; no production deployment requested |

## 3. apps/api work

- [x] **`lab_execution` module.** Reuse `Depends(identity)` (Firebase `verify_id_token(check_revoked=True)`, Google provider) and the `CRS-AC-ECE` enrollment check. Load `learners/{uid}/labPreparations/{prepId}`; a foreign or missing preparation returns 404.
- [x] **Link document** `learners/{uid}/labExecutions/{prepId}` = `{schema:"lab-execution-link/v1", backendLabId, backend:"kiki-backend-python", practicalId:"PR-AM-DSB", contentVersion, createdAt}`.
  - Create it in a transaction on the first execution call, with upstream `POST /lab-sessions {operator_trial:true, model_name:<projectRef or "dsb_sc">, progression_mode:"screen_guided"}`.
  - A transaction reserves the link before upstream POST, and sends an `Idempotency-Key`; concurrent creates yield at most one upstream lab per preparation. The pinned upstream ignores the header. Ambiguous failure is held for reconciliation, not automatically retried; see the implementation handoff for that recovery limit.
  - Checkpoint IDs already match (`CP-DSB-01…12`).
- [x] **Upstream client settings:** `KIKI_LAB_BACKEND_ORIGIN` (HTTPS in cloud mode; `http://127.0.0.1:8100` only in local mode) and server-only `KIKI_LAB_PROXY_SECRET` (32+ characters).
  - Every call sends `x-kiki-owner: fb:<uid>` and `x-kiki-proxy-key`, and rewrites `Origin` to the upstream origin; kiki-backend rejects mutations otherwise.
  - Strip client cookies and any `x-kiki-*` headers. Follow no redirects; set timeouts and a frame body limit.
  - Move `httpx` to runtime dependencies and add a WebSocket client library.
- [x] **Routes.** An explicit allowlist with no generic path proxy. All under `/lab-preparations/{prepId}/execution`:

  | kiki-web route | kiki-backend upstream |
  | --- | --- |
  | `POST` (create or return link + state), `GET` | `POST /lab-sessions`, `GET /lab-sessions/{lab}` |
  | `POST /screen-sessions` | `POST /screen-sessions` |
  | `POST /stream-ticket` | — (one-time HMAC ticket, about 60 s, bound to uid + prep + screen session) |
  | `WS /screen-sessions/{sid}/stream?ticket=` | `WS /screen-sessions/{sid}/stream` (two-way relay) |
  | `POST /attach` | `POST /lab-sessions/{lab}/attach` |
  | `POST /check-stream` | `POST /lab-sessions/{lab}/check-stream` (SSE `lab-analysis-stream/v2`) |
  | `POST /context` | `POST /lab-sessions/{lab}/context` (pause/resume, view/parameter change, revisit) |
  | `POST /review`, `POST /responses` | same |
  | `GET /events`, `GET /image` | same |

- [x] **SSE passthrough:** a `StreamingResponse` over an `httpx` stream, with chunks in order and no buffering.
- [x] **WebSocket:** browsers cannot send `Authorization`, so use the ticket. Check `Origin` against the CORS list by hand, and close when the ticket or token is revoked.
- [x] **Error mapping:**
  - Pass 409 through; the client refreshes and never overwrites.
  - Upstream 401 or unavailable → 503, "Lab tracking is unavailable; your progress is kept."
- [x] **Monitoring:** when a link exists, derive `monitoring.status` from execution state instead of pinning `pending_integration`. Change the Pydantic `Literal`, the Zod literal (`src/contracts/lab-preparation.ts:15`) and `LAB_PREPARATION_CONTRACT.md` together. `pointerActive` stays false; the floating windows replace the pointer in this slice.
- [ ] **Production CORS (B1, deferred by user):** add the production origin once one is selected. Local Origin checks use5174; DELETE is not needed.
- [x] **Tests** (pytest with a fake upstream):
  - forged `x-kiki-owner` is stripped;
  - a foreign preparation returns 404;
  - expired, reused or mismatched tickets are refused;
  - SSE arrives incrementally and in order;
  - the WebSocket relay works and closes on revoke;
  - upstream down → 503;
  - one upstream lab per preparation under concurrency.
- [x] **OpenAPI:** regenerate `openapi.json`; update `apps/api/active.md`.

## 4. apps/web work

- [x] **Contracts:** Zod schemas for the kiki-backend lab state fields actually used, mapped in one adapter. Do not reuse the provisional `LabSession` in `src/contracts/api.ts:302-455` without reconciling it.
  - Fields:
    - from `guidance`: `current_action`, `next_action`, `next_instruction`, `action_position`, `procedure`, `already_tracked`;
    - from `runtime`: `capture_active`, `analysis_status`, `retry_after_ms`, and `candidate` with `admitted_context` and `source_frame`;
    - from `observation`: `age_ms`, `observation_id`;
    - plus `status`, `revision`, `queue`, `steps`.
  - Keep kiki-backend's names authoritative.
- [x] **Services:** a `lab-execution-http` adapter (Bearer token, timeouts and status mapping, as in `lab-preparation-http.ts`) and a ticketed WebSocket frame channel.
- [x] **Capture hook** in `features/labs`:
  - `getDisplayMedia` only on a user gesture, with picker guidance (choose the Chrome tab showing MATLAB);
  - a frame about every 2 s, longest side at most 1600 px;
  - **redact Kiki window rectangles on the copied canvas, then JPEG-encode** (ADR 0009);
  - send over the WebSocket, then check with `{revision, frame_id, view_revision}`;
  - analyse only when `displaySurface === 'browser'` and the capture handle matches the bound tab;
  - stop on sign-out through `registerSignOutCleanup` / `withResourceCleanup`.
- [x] **Check-stream client:** adopt state only from `guidance_committed`; provisional findings are a labelled preview; honour `waiting_for_provider` / `retry_after_ms`.
- [x] **Kiki window publisher.** Port kiki-backend's `prototypes/json_stream_site/assets/floating-guidance.js` (pure projector) and `floating-bridge.js` (bridge, redaction) to TypeScript.
  - Protocol `floating-guidance/v0.1` over `window.postMessage` channel `kiki-floating-guidance`, unchanged.
  - Send a snapshot on every content change and at least every 5 s.
  - Window pause/resume calls the same `/context` action as the page button.
- [x] **Connection panel** replacing "Monitoring not connected" in `LabPreparation.tsx`:
  1. Open MATLAB Online.
  2. Show Kiki on MATLAB: detect the extension, otherwise show install steps.
  3. Share your MATLAB tab.
  4. Then show the states connecting → active ⇄ paused → disconnected → completed. Each non-active state has a reason and a recovery action. Reconnecting needs a fresh gesture. These states follow the historical [v0.3 contract §8](../../docs/CONTRACT-v0.3-reference.md#8-lab-session-contract); re-confirm them, since that file does not override current contracts.
- [x] **Tests:**
  - Vitest ports of the projector and bridge unit tests.
  - A Playwright end-to-end run with kiki-backend's dev extension (Playwright Chromium; tab-capture auto-select flags as in kiki-backend `prototypes/floating_guidance/tests/check-local-lab.py`) against a local kiki-backend with a fake analyzer. It proves:
    - starting from Lab mode;
    - Lab mode and the windows showing the same step;
    - pause from both sides;
    - model-bound frames free of Kiki's windows;
    - lifecycle states.
  - Update `apps/web/active.md`.

## 5. Not in this repo (dependencies)

| Owner | Item |
| --- | --- |
| kiki-backend | Python parity spike for the fields in §4 (local, behind `SiteProxyGuard` with `KIKI_REQUIRE_PROXY=1`); hosting (B2); a `fb:<uid>` owner test |
| kiki-backend | Extension `readers` allowlist: add `http://127.0.0.1:5174` now, the production origin after B1, and rebuild |
| Aditya | Agreement on this path and on the open questions in `LAB_PREPARATION_CONTRACT.md` §"Later integration" (B3) |

## 6. Acceptance for the first local slice

**Automated local acceptance passes** with React Lab mode, the real dev extension/native tab capture, actual Python service and a fake analyzer against a controlled target. Now/Next, both pause controls, pre-encoding masks with positive/negative canary controls, provider waits, Stop/reconnect, target reload, page reload, sign-out and responsive layout are covered. This is not a claim of real MATLAB or live Gemini acceptance. The student-controlled MATLAB trial below remains pending, as do B1/B2 production setup. [Exact commands and remaining gates](LAB_SCREEN_SHARE_IMPLEMENTATION.md).

With the real extension and MATLAB Online, a student starts sharing from `/labs/:sessionId` with no demo page open. Then:

- The Kiki windows show the same Now/Next as Lab mode after every committed read and after pause/resume from either side.
- Model-bound frames show grey boxes where Kiki is.
- Stop sharing, MATLAB reload, Lab mode reload, sign-out and provider waits each end in the right state with a recovery action.

For reference, the kiki-backend demo flow measured frame received → committed at p50 4.7 s and p90 10.1 s (79 live reads, 17 October).
