# Physical lab UI integration

User intent: the reusable experiment pipeline belongs in kiki-backend, while the student-facing physical lab experience follows the existing kiki-web Lab mode. This branch starts from current main `08644eb` and preserves the software experiment and its screen-share workflow.

## Ownership and flow

| Layer | Files / responsibility |
|---|---|
| Existing Lab entry | `apps/web/src/features/labs/LabPreparation.tsx` adds physical equipment practice alongside software preparation |
| Authenticated routes | `/labs/physical` and `/labs/physical/:sessionId` use existing Session, StudyRoute and Shell |
| Presentation | `apps/web/src/features/labs/physical/PhysicalLab.tsx`, renderer, hints and CSS |
| Browser service | `apps/web/src/services/physical-lab-http.ts`, registered in existing service composition root; Firebase bearer to web API only |
| Web API relay | `apps/api/src/kiki_api/physical_lab_routes.py` verifies identity/enrollment and uses existing fixed-origin LabUpstream; credentials and owner derivation stay server-side |
| Experiment engine | [backend PR #14](https://github.com/Kikiland-ai/kiki-backend/pull/14): packs, versioned glTF content, prerequisites, procedure rules, state/persistence, numerical observations, faults, readiness and results |

Start creates an explicit `experiment_demo`, with a stable creation key for retry. Resume loads the session's pinned pack and equipment. Port clicks submit queued semantic actions using the latest saved revision. The backend validates each lead/setting/measurement and returns the next step. A lost response can retry the exact original event; a conflict requires explicit reload rather than rebasing. Navigation and sign-out abort in-flight work and destroy viewer listeners/observers.

The floating guide shows component names only. Numbered markers and cursor-adjacent hover/focus hints help the student find the component. Fullscreen contains the apparatus, guide, tooltip and controls. Plots and the CRO render backend traces; no signal physics is recreated in the frontend. The backend still retains normal preparation and prerequisite checks. This frontend entry assumes theory knowledge for the requested demo and clearly reports virtual practice rather than physical execution/readiness.

## Configuration and local acceptance

The web API relay is off by default. Enable `KIKI_PHYSICAL_LABS_ENABLED=true` only with the existing configured authenticated lab upstream (`KIKI_LAB_EXECUTION_MODE`, `KIKI_LAB_BACKEND_ORIGIN`, `KIKI_LAB_PROXY_SECRET`). Local upstream remains the approved `http://127.0.0.1:8100`; cloud mode retains HTTPS, IAM audience and server-only secret protections. Point it at the unified backend revision containing PR #14. Keep one backend instance and a persistent SQLite volume. Do not enable against an older screen-only runtime.

No auth bypass or fixture fallback is added to connected mode. For isolated local acceptance only:

```sh
# Repo root, after uv sync --frozen in apps/api:
apps/api/.venv/bin/python apps/api/tests/physical_lab_preview_server.py --backend-root ../kiki-backend-physical-labs
# Another terminal:
cd apps/web
npm run dev -- --port 5202
```

Open `http://127.0.0.1:5202/tests/physical-lab/index.html`. This explicitly labelled harness uses a synthetic preview identity and temporary records, the real web relay, and the actual sibling experiment engine through ASGI. No Google, Firestore or model calls run. Its auth double exists only in the test server. Neither harness nor recorded test fixtures is imported by the production app. The regular Kiki route still requires normal sign-in/enrollment and the configured upstream.

## Verification and remaining acceptance

- Full web unit suite: 317 passed; TypeScript, ESLint and connected production build passed.
- Ten renderer/picking/hint/CRO checks moved from the backend and pass in frontend CI.
- Full web API suite: 274 passed, 8 opt-in skips; Ruff passed.
- Six React flow checks cover creation without theory clicks, guide names/hover labels, all nine recorded engine steps, exact event retry, pinned pack load and mismatch rejection. Three service checks cover auth/creation, conflicts and wrong session identity. Ten proxy cases cover auth, ownership, origin/body/path bounds, statuses and disabled configuration.
- Live local HTTP acceptance through web relay + real backend completed all nine actions, ending `experiment_complete` with theory unassessed and recovered 1000 Hz / 0.5 V peak.
- Native Chrome verified the frontend model, component hints, name-only guide, fullscreen, wrong-lead rejection, progression and a retry. Full nine-step native-browser acceptance and signed-in Firebase/hosted acceptance remain distinct from recorded unit/HTTP acceptance.
- Local dependency installation hit disk pressure. Frontend checks reused matching installed dependencies plus the declared KaTeX package; API dependencies were installed from uv.lock. Later backend test reruns reproduced `SQLITE_IOERR_SHMSIZE`, including in unchanged stores and a bare WAL reopen probe. Do not represent those reruns as passes or change storage policy to hide the machine failure; verify the backend CI.

Last completed: [frontend PR #22](https://github.com/Kikiland-ai/kiki-web/pull/22) published and backend PR #14 updated with the repository boundary. [Backend clean-runner acceptance passed](https://github.com/Kikiland-ai/kiki-backend/actions/runs/44823028370), including the full offline gate and physical pipeline/schema/asset smoke. Next: review the frontend companion and backend PR #14, configure the authenticated upstream, and perform signed-in hosted acceptance. No merge, deployment, IAM change or learner migration is included.
