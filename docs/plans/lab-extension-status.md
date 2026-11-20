# Lab extension status — 21 November 2026

Status: local implementation complete; not published or deployed.

Objective: after sign-in, show extension health immediately left of Lab mode,
replacing the language tag, and offer the latest package without duplicate installs.

## Behavior and boundaries

- Green: detected version is at least the latest published version. Red: no
  extension response in this browser profile within 2.5 seconds. Disabled,
  unsupported-browser and missing-site-permission cases also mean not detected;
  web pages cannot inspect arbitrary installed system packages.
- Yellow: installed version is older, or latest metadata could not be verified.
  Neutral during initial check. Accessible names explain each color.
- Check on signed-in Shell mount, every five minutes while visible, focus,
  online and visibility restoration. Fetch same-origin latest.json with no-store
  and a five-second deadline. No auth tokens or learner data are sent.
- No reader_hello, capture, target binding or lab command during status polling.
  Sign-out/unmount disposes active listeners, timers and fetches.
- Canonical backend bridge/background gain reader_status, returning the runtime
  manifest version without changing controller/generation/binding. Release 0.1.4.
- Legacy 0.1.3 and earlier announce only at page load: main.tsx passively remembers
  a recent public version before async sign-in finishes. Known legacy versions
  remain yellow because their presence cannot be revalidated. No persisted cache.
- Unpacked extensions cannot self-update. The panel downloads the canonical release
  ZIP and explains replacement in the original folder + Reload, avoiding a second
  Load unpacked installation. Reload the Kiki page after extension updates so
  Chrome injects the new bridge. A current install offers no download prompt.

## Files and release workflow

Web: src/features/extension/{extension-status.ts,ExtensionStatus.tsx}, Shell.tsx,
main.tsx, ui/styles.css, public/lab-extension, scripts/package-lab-extension.mjs.
Firebase hosting sets no-store for /lab-extension/**.
Backend: prototypes/floating_guidance/extension/{bridge.js,background.js} and
scripts/build-extension.mjs, with lifecycle regressions.

From apps/web, run `npm run package:lab-extension -- /absolute/backend/checkout`
after a canonical extension release. This calls the backend builder, selects only
release (never dev), then writes the ZIP and latest.json together. Commit those
public assets with the frontend change; plain web builds do not need a backend
checkout. Deploy updated metadata and ZIP together. Do not advertise a version
before its matching package is available.

Chrome automatic update distribution requires Web Store or managed distribution:
https://developer.chrome.com/docs/extensions/how-to/distribute
No store listing/id exists in the current canonical builder. Store publication
and conversion from unpacked installs remain a separate release decision.

## Verification

- Full existing web suite plus first nine new checks: 328 tests passed.
- Final extension-status suite including early legacy announcement: 10 passed.
- Typecheck, ESLint and production build passed. Build retains existing large-chunk warning.
- Backend lifecycle suite with KIKI_WEB_CHECKOUT set: 19 passed, none skipped.
  Includes worker sender validation/no state mutation, real bridge protocol,
  and actual web publisher StrictMode/lifecycle regression.
- Chrome sample browser checks at 390 and 1280px: 2 passed. Verified green/yellow/red,
  icon placement left of Lab mode, download URL, duplicate-install instructions,
  Escape/focus return and no page overflow. Screenshots inspected in ignored
  apps/web/test-results/extension-status-{390,1280}.png.
- Default Playwright launch initially blocked by missing bundled Chromium;
  tests passed using installed Google Chrome via temporary config, then removed.
- Packaged ZIP verified byte-for-byte against the canonical release; metadata matches 0.1.4.
- Backend context integrity, BB8 reference validation and discovery sync checks passed.
- Browser scenarios use labelled sample auth and protocol doubles. No Google,
  Firestore, actual extension installation, production delivery or provider trial.

## Now / Next / Later

Now: local UI, bridge probe, release package and regressions complete.
Next: review and publish the web + companion extension source together when requested;
verify signed-in hosted origin with actual release 0.1.4, disabled/missing extension,
and update an existing unpacked install in place.
Later: choose Web Store/managed distribution for Chrome-owned automatic updates.

Rollback: revert this web slice and companion probe/version bump together. No
schema migration, backend API rollout, learner reset or lab state changes required.


## Assisted setup follow-up — 21 November

The header uses a puzzle-piece icon, exclamation badge, Install/Update label at
desktop widths and a three-cycle attention pulse; reduced motion disables it.
`prepare-extension.ts` uses showDirectoryPicker on the explicit click, before
fetching. Users approve read/write access. The real release ZIP is validated
before any writes, then extracted to an empty/recognized Kiki directory; unrelated
files/extensions are refused, .DS_Store is preserved. A setup marker permits
retrying partial writes. The manifest is written last. No nested directory or
second Chrome installation is created by folder preparation. ZIP download is
retained where the folder API is unavailable. The page can copy chrome://extensions
and offers an explicit Reload Kiki button; Chrome still owns Developer mode and
Load unpacked/Reload. No unattended installation or extension-manager setting change.

Checks: 16 focused tests, typecheck/lint/build, three Chrome tests passed. Folder
handles are doubled in tests; native permission and actual installation remain
manual acceptance. A trace-enabled browser run hit disk exhaustion; the no-trace
rerun passed. No deletion of user files was performed.

Primary browser constraints:
https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
https://developer.chrome.com/docs/extensions/how-to/distribute


## PR source provenance

The web PR is based on main 90f7d59 (narration PR #23), independently of physical
lab PR #22. The bundled ZIP contains the canonical release output after the
companion source change in [backend patch](../patches/lab-extension-status-backend.patch).
The patch includes bridge/worker changes, version bump and lifecycle tests, and
is provided for review/reproduction; it does not publish a backend branch or PR.
Apply it to the compatible kiki-backend source before rerunning the packaging
command. The builder rejects releases older than 0.1.4. This web PR includes the
working package, so deployment does not require a live backend API change.


## Approved extension branding — 21 November

User approved the K + green dot design. The source SVG and transparent 16/32/48/128
PNGs are in apps/web/assets/lab-extension. The web packaging layer adds these
assets and manifest.icons/action.default_icon to the canonical release; upstream
host permissions and executable files remain unchanged. The current bundle is
0.1.5, with matching backend config/manifest/release metadata, so iconless 0.1.4
installs are reported outdated. The companion source patch includes this bump.
The folder preparer accepts the four flat PNG files and updates iconless folders
in place. The earlier 0.1.4 byte-for-byte canonical-package statement is historical;
current web branding is a deliberate packaging overlay with its own reviewable
source. Checks: 18 focused tests, lint/typecheck/build and three Chrome cases pass.
