# kiki-web ↔ kiki-backend: integration testing and deployment handoff

18 October 2026, Asia/Kolkata. This is the kiki-web side of the handoff. The full picture, including the backend, deployment and the decisions still open, is kiki-backend's [integration and deployment handoff](https://github.com/Kikiland-ai/kiki-backend/blob/main/docs/handoffs/integration-and-deployment.md). That link resolves once kiki-backend PR #7 is merged; until then read it on the `fix/lab-integration-small` branch.

## State

- kiki-web `main` is `b984c64`.
  - Merged: Lab mode screen sharing (PR #7) and docs pointing at kiki-backend `main` (PR #8).
  - Closed: #2, #3, #6. Their content arrived through #5 and #7.
- **Open: PR #9, `fix/lab-integration-small`.** It contains:
  - `skipped` frame handling;
  - a create retry with the saved `Idempotency-Key` and body;
  - a per-platform Playwright venv path;
  - UTF-8 writes;
  - the first CI workflow (web and api jobs, both passing);
  - this file.

  **Merge it after kiki-backend PR #7.** The retry assumes the backend replays a repeated key; against an older backend it could create a second lab.
- Ownership (`TEAM_HANDOFF.md`): Arpan has learning screens, the kit and media; Akshita has the router, services, account and Library; Aditya has lab assessment.

## Testing against kiki-backend on another machine (chosen: SSH forward)

kiki-web's API accepts the backend only at `http://127.0.0.1:8100` in local mode, or at an HTTPS origin in cloud mode. A plain LAN address is rejected, so the backend is forwarded over SSH and kiki-web keeps its local settings.

1. **Backend machine:** start kiki-backend on port 8100 with `KIKI_REQUIRE_PROXY=1` and a fresh secret, and enable OpenSSH Server. See kiki-backend `docs/plans/connected-integration-testing.md`.
2. **This machine:** forward the port.
   ```sh
   ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.1:8100:127.0.0.1:8100 <user>@<backend machine>
   ```
   Then check it the way this API will call it: run `KIKI_PROXY_SECRET=<secret> python -B scripts/smoke-lab-upstream.py` from a kiki-backend checkout. All nine checks should pass.
3. **`apps/api/.env.local`:** set
   ```sh
   KIKI_LAB_EXECUTION_MODE=local
   KIKI_LAB_BACKEND_ORIGIN=http://127.0.0.1:8100
   KIKI_LAB_PROXY_SECRET=<the same secret>
   ```
   Keep the existing Firebase settings. Start the API with one worker:
   ```sh
   uv run uvicorn kiki_api.main:app --factory --host 127.0.0.1 --port 8000 --no-access-log
   ```
   WebSocket tickets are held in memory, so only one worker can serve them.
4. **`apps/web`:** run `npm run dev:connected -- --port 5174`. The API's CORS defaults expect port 5174.
5. **Extension:** build kiki-backend's extension with `node prototypes/floating_guidance/scripts/build-extension.mjs`, then load `work/floating-guidance/dev/` unpacked. Its dev build now includes `http://127.0.0.1:5174`.
6. **Trial:** sign in at `http://127.0.0.1:5174` and open MATLAB Online in another tab. From `/labs/:sessionId`, start screen guidance and share the MATLAB tab. Record the results in `apps/web/active.md`.

The step-by-step local setup is in [LAB_SCREEN_SHARE_IMPLEMENTATION.md](../../apps/web/LAB_SCREEN_SHARE_IMPLEMENTATION.md). On Windows, the lab Playwright suite's fake-analyzer server needs `PYTHONUTF8=1`, because of a frozen kiki-backend file.

## kiki-web tasks to pick up

| Task | Notes |
| --- | --- |
| Lab Playwright suite against a real backend | Add a switch that skips the bundled fake-analyzer server and uses `KIKI_LAB_BACKEND_ORIGIN`, with an auth-emulator ID token (`demo-kiki-local`) |
| Lab home banner when execution is disabled | It shows "Practise with screen guidance" even when `KIKI_LAB_EXECUTION_MODE=disabled`. The recommended fix is an API capability field (for example `screenGuidance`) on the lab preparation response, read by `LabHome`/`Readiness` instead of `Boolean(services.labExecution)`. This changes `LAB_PREPARATION_CONTRACT.md`, so it needs a decision first |
| Readiness gate | Students can start screen guidance before passing the seven concept checks (`operator_trial`). Confirm with the product owner |
| Shared WebSocket ticket store | Needed only if the API runs more than one worker |
| Concept canvases from kiki-backend's concept library | Wait for the decisions: keep or replace the C-AM-08 package; React renderers or sandboxed iframes; per-placard or whole-concept narration. After that: generalise the scene schemas, add projections and renderers, and remove the C-AM-08 hard-wiring in the fixtures and tests |

Generated text and audio reach kiki-web through the database, not by calling kiki-backend's job API (kiki-backend ADR 0011). Media hosting is tracked separately.

## Deployment (kiki-web parts)

| Item | State | Needed |
| --- | --- | --- |
| Web hosting (B1) | No host config and no single-page-app fallback | Choose a host and an HTTPS origin, then add the fallback |
| API hosting | No Dockerfile; runs with ADC locally | A container or Python host running one worker (or with shared tickets) |
| Lab execution in production | `local` mode only | `KIKI_LAB_EXECUTION_MODE=cloud` with kiki-backend's HTTPS origin (B2) and the secret, stored as server-only settings |
| Origins | Dev origins only | Add B1's origin to `KIKI_CORS_ORIGINS`, Firebase Authorized domains (project `builder-cup-a8479`) and kiki-backend's release extension `readers` |
| CI | Added in PR #9 | Make it a required check once merged |

Order: deploy kiki-backend and run its smoke script against the HTTPS origin, then deploy this API in cloud mode, then the web app, then add the origins.

## Known local quirks

- A worktree nested inside another kiki-web checkout fails `src/fixtures/assessments.test.ts`. The outer `package.json` makes `data-model/runtime/learning-case.js` load as an ES module. Clean clones and CI pass.
- On TLS-inspecting networks, `uv sync` needs `--system-certs`.
