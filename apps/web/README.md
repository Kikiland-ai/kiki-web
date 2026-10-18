# Kiki web — Akshita frontend slices

React + TypeScript + Vite, with Google-only Firebase authentication and a Python API boundary. White background, Google Sans with Odia fallback, green concepts / red words / yellow academic English / blue practical application. One responsive application works on laptops and adapts to phones.

For a click-by-click review, open [the current UI walkthrough](../../docs/ux/ui-slice-review.md). The current [frontend status](active.md) is updated after each completed step and separates working preview features from pending live integrations. [Build history](../../docs/plans/ui-build-progress.md) retains earlier details.

## Run the sample preview

Use **Node 24.12+** (`.nvmrc` selects Node 24). The initial plan suggested Node 22; the locked Firebase 13 SDK requires Node 24.12+. The original shell has Node 20.10, so this slice was run using a temporary npm-provided Node 24, without changing the global installation.

```sh
cd apps/web
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** → Get started → **Open sample student**. Google sign-in is disabled in this explicit development preview. Onboarding, subject enrollment and profile changes persist as synthetic data in this browser; they do not create a Google account or synchronize to another device. Clear this preview origin's site data to reset the sample.

If your default Node is still 20.10, the tested alternative is:

```sh
npm exec --yes --package=node@24 -- npm ci
npm exec --yes --package=node@24 -- npm run dev
```

Completed screens: Welcome; Google sign-in UI/device choice; four-step resumable language/confidence/support/confirmation; Home; ECE Analog Communication subject setup/overview; editable Profile and sign-out; material intake/status/outline review; Library and original-file viewer/download. In the preview, actual selected files persist in browser IndexedDB and processing advances only through explicit labelled sample controls. Concept/chapter MCQs, saved drafts, results and retries now work with explicitly labelled preview scoring. Learning and labs still show build-boundary pages. No live OCR, generated lessons, evaluated proficiency, speech, cross-device sync or simulator activity is claimed.

**Review the second slice:** Home → Add today’s material → Choose files → Save material in preview → Preview sample outline → Confirm outline and prepare lessons → Preview ready state. Library reopens the original files and saved request states. See [the intake transport contract](INTAKE_CONTRACT.md) for the implemented API adapter and pending Python endpoints.

**Review the assessment slice:** Home → Practise concepts → Start concept check → answer five questions → Submit check. Change question language, refresh or Pause and leave to check saved drafts. Results show correct/incorrect feedback and revisit/retry; the chapter has ten questions. [Assessment contract](ASSESSMENT_CONTRACT.md) describes the implemented adapters and pending Python integration.

## Connect Firebase and Python

[Firebase setup and Library storage explanation](FIREBASE_SETUP.md) tracks the actual project configuration and Google-to-Python acceptance sequence. Use `npm run check:connected` before the connected review. Keep preview on 5173 and start connected mode with `npm run dev:connected -- --port 5174`; `/connection` is a development-only diagnostic, not a substitute profile backend.

Copy `.env.example` to `.env.development.local`, fill the **public web** Firebase configuration and API address, then:

```sh
npm run dev:connected
```

This mode never falls back to sample data. `VITE_AUTH_EMULATOR_URL` is allowed only during development, on localhost, with `demo-kiki-local`. Remove it only for an intentionally configured staging Firebase project. The existing user-supplied Firebase project now has Google sign-in/local domains configured and its popup/reload/sign-out checked. The [Python profile API](../api/README.md) now verifies Google identity and saves profiles/onboarding/enrollment in Firestore. Keep it running on port 8000 alongside this connected UI. Cloud intake, assessments/content and labs are separate pending APIs; no new project, Storage setup or deployment was created.

The frontend calls the [aligned profile/feature contracts](CONTRACTS.md) and [proposed intake contract](INTAKE_CONTRACT.md) and [assessment contract](ASSESSMENT_CONTRACT.md). The Python service must verify the Firebase bearer token, create/load the UID-keyed profile idempotently, persist profiles/requests/jobs in Firestore and store originals in private Firebase Storage. No direct client Firestore write or new permissive rules are introduced here. The HTTP adapters are implemented; the corresponding Python/Storage/extraction integration remains pending.

Google popup and explicit redirect adapters are implemented. Test real redirect behavior on the selected auth/hosting domain according to [Firebase's redirect setup guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices). Shared-computer sign-in defaults to session persistence; personal-device persistence is opt-in. Authentication errors, missing setup, bootstrap failure and rejected saves surface errors/retry. A valid Firebase identity is needed before private routes render; `signedIn` content fields are never trusted. Production build refuses fixture mode and removes the fixture module.

## Validate

```sh
npm run lint
npm run typecheck
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

Use the npm-provided Node 24 prefix above for these commands if needed. Browser tests use labelled fixture mode. They prove UI flow/persistence/recovery/layout; they do not prove Google OAuth, Firestore permissions, Python integration or real phone/browser behavior. A connected staging/emulator run and physical Android/iPhone checks are still required. Build output requires SPA fallback to `index.html` on the eventual host; hosting is not configured yet.

`@grpc/grpc-js` is pinned to patched 1.14.6 via an override because Firebase's unused Node Firestore dependency initially resolved a version flagged by npm audit. The web uses modular Firebase Auth only; keep the override until the parent dependency resolves the patch itself.

## Working together

Read [ARPAN_HANDOFF.md](ARPAN_HANDOFF.md) before editing shared files. Akshita owns app/service boundaries and her feature folders. Arpan takes continuing ownership of the small baseline kit under `src/ui`, and supplies learning/lab feature modules. Current SVG imports reference this repository's original design-system assets; preserve that directory when moving the app into a separate frontend checkout, or coordinate a reviewed asset copy.

Relevant decisions: [journey](../../docs/ux/student-journey-odia-ece.md), [implementation plan](../../docs/plans/ui-implementation-plan.md), [allocation](../../docs/plans/ui-team-local-validation.md), [current status](active.md).

## Combined learning preview (15 October)

Open http://127.0.0.1:5173/learn → Open sample student → chapter → lesson → concept check → result → Chapter map. Same app/profile/quiz records, browser-only preview. Arpan source 2256077 is adapted under current Gate/services; see [LEARNING_CONTRACT.md](LEARNING_CONTRACT.md). Connected 5174 keeps real Google/profile and uses learning HTTP errors until Python content/position/scoring endpoints exist; no sample fallback.

## Live Firestore learning — 15 October

Use http://127.0.0.1:5174/learn with Google. The source catalog, owned positions and assessment endpoints now use Python/Firestore; 5173 remains the labelled sample preview. Add your subject/semester first. Current acceptance, next student check and dependencies are in [active.md](active.md); importer/schema/rollback are in [LEARNING_STORAGE.md](../api/LEARNING_STORAGE.md).

## Saved lab preparation — 16 October

Open http://127.0.0.1:5174/labs with Google, then Start/Resume lab preparation. Read checkpoints, save prediction/model/observation drafts and copy the session locator for the same account. localhost links are same-computer only; actual phone/laptop continuation needs shared hosting. Aditya’s monitoring/assessment integration and Hey Clickky remain pending. See [active.md](active.md) and [LAB_PREPARATION_CONTRACT.md](LAB_PREPARATION_CONTRACT.md).

## Local lab screen guidance

The optional PR #6 integration runs from Lab mode at127.0.0.1:5174 through this repository's authenticated API. It defaults to disabled server-side. Read [setup, verification and remaining gates](LAB_SCREEN_SHARE_IMPLEMENTATION.md) before enabling it. The development extension/native-capture acceptance suite uses `playwright.lab.config.ts`; it is separate from normal browser-only fixture tests and requires the pinned backend checkout. No production origin or deployment is configured.
