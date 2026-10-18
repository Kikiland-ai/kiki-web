> **PR publication and merges, 18 October:** [all-CAM PR #12](https://github.com/Kikiland-ai/kiki-web/pull/12) is open into main; #9/#11/#10 merged with API/web CI passing, resulting main `7eb394592f3cf6a56f981363e9ee490c89c0b651`. Fresh combined all-CAM checks pass: 236 frontend/145 API tests, code/build/contracts and 13 serial browser cases. PR #12 remains open; no deployment/cloud/media-head/learner changes. [Current status](apps/web/active.md). Earlier records retain history.

> **All-ten local CAM consumer, 18 October:** isolated `integration/all-cam-2026-10-18` / `kiki-web-all-cam-2026-10-18` at `fa87fb61c6b0dd27658ffc495bcb8d74a243ce4c` has an uncommitted local integration. One shared renderer/v1 scope extension supports all ten; 26 original recordings verified; native C-AM-08 preserved. 144 API / 231 frontend / 38 model cases and final ten-concept browser journeys pass. Publication/private storage/signed-in delivery and content review remain gates; no commit/push/deploy/cloud/learner changes authorized in this slice. [Current evidence](docs/evidence/all-cam-coverage-2026-10-18.md). Earlier sections retain history.

> **Published preferences,18 October:** [PR #10](https://github.com/Kikiland-ai/kiki-web/pull/10) is open into `main` from `redesign/aditya-multilingual-profile`, source `dd94b9f`, authored/pushed as `akshitanitr`.185 frontend/119 API/16 browser checks pass. Merged #7/#8 retained; #9 remains separate. Next: review #10 and genuine connected-profile retry. No merge/deployment. [Current status](apps/web/active.md).

> **New preference UI PR,18 October:** user authorized commit/push and a separate PR from `redesign/aditya-multilingual-profile` into `main`. Latest `main` (`b984c64`, merged #7/#8) is incorporated; open #9 remains separate. Generic language/field setup, Aditya sample, context-aware teaching availability, welcome cleanup and profile-load error wording pass185 frontend/119 API/16 browser checks plus code/build/contracts. Credential-path recovery is local configuration; no credentials or learner records are included. No merge/deployment. [Current status](apps/web/active.md), [scope](apps/web/MULTILINGUAL_PROFILE_UI.md). Older publication notes below are historical.

> **Connected preview recovery,18 October:** corrected API8001's process-only credential directory resolution when loading the original checkout's env. Read-only Firestore probe passes; invalid bearer now401 instead of dependency503. Removed public Aditya example paragraph; profile-load errors no longer claim a failed save.11 focused frontend checks, lint/typecheck and anonymous connected browser checks pass. User should Retry/refresh http://127.0.0.1:5194/auth for the genuine Google/profile round trip. Local/uncommitted; no learner writes or IAM change. [Current status](apps/web/active.md).

> **Language/field-flexible UI,18 October:** local `redesign/aditya-multilingual-profile` keeps Kiki's general positioning and uses Aditya/Odia/ECE as one example. Editable saved language/field preferences drive subsequent UI; prepared teaching remains the Odia/English ECE demo, with explicit availability for other combinations. Existing learner records and Google names are retained.183 frontend/119 API tests, code/build/contracts and16 browser cases pass. Sample5195 and connected5194/API8001 run this local revision. No commit/push or live learner/provider write. [Current status](apps/web/active.md), [scope and contracts](apps/web/MULTILINGUAL_PROFILE_UI.md).

> **Merged, 18 October:** the implementation is on `main` as PR #7 (`0ee6646`, merge `0ed7c06`). The kiki-backend code it calls is on kiki-backend `main` (its PR #3); the backend branches named in older notes were deleted after that merge. Open items by owner are in the [kiki-backend lab handoff §0](https://github.com/Kikiland-ai/kiki-backend/blob/main/docs/handoffs/kiki-web-lab-mode-screen-share.md); testing across machines (SSH forward, ngrok or Tailscale) is in [connected integration testing](https://github.com/Kikiland-ai/kiki-backend/blob/main/docs/plans/connected-integration-testing.md).

> **Local PR #6 implementation, 18 October:** `feature/lab-screen-share-implementation` builds on plan PR #6 `29724c7` and merged redesign main `93cce9b`. Aditya approved the path; user requested local operation. The API-fronted screen guidance, capture redaction, floating-window coherence and lifecycle controls are implemented locally.180 frontend/118 API tests, code/build/contracts checks, actual Python + dev-extension/fake-analyzer acceptance and eight saved-preparation browser regressions pass. User authorized commit and push on the separate implementation branch; no PR update, merge, deployment or live learner/provider trial. Real MATLAB acceptance, production setup and upstream durable retry recovery remain gates. [Current status](apps/web/active.md), [local setup and limits](apps/web/LAB_SCREEN_SHARE_IMPLEMENTATION.md). Older publication/monitoring notes below are historical.

> **Published redesign,18 October:** source commit `e951a83` is pushed on `redesign/sketchbook-refinement`; [PR #5](https://github.com/Kikiland-ai/kiki-web/pull/5) targets `main`.154 frontend/104 Python/28 source-model tests and code/schema/production checks pass. No deployment. Keep #1–#3 open until #5 merges and their then-current heads are confirmed covered. [Current status](apps/web/active.md).

> **Publication checkpoint,18 October:** user authorized commit/push of `redesign/sketchbook-refinement` and a new PR into `main`. Fresh154 frontend/104 Python/28 source-model tests, lint/format/build/contracts/schema and candidate-source/production scans pass. Optional-media enrollment-order regression repaired. #1 is ancestral, #2 source coverage verified with documented adaptations, all7 #3 paths match. Keep existing PRs open until replacement merge and a fresh head-coverage check. No deployment/cloud changes. [Current status](apps/web/active.md).

> **Redesign priority, 18 October:** Engineering Sketchbook now covers every current route and shared loading/recovery/leave state locally on `redesign/sketchbook-refinement`. 154 frontend tests, lint/build and recorded native phone/zoom/keyboard checks pass. User asked to finish redesign before returning to PRs; no more PR work/remote changes. Review http://localhost:5195/; connected5194 remains. [Authoritative status and limits](apps/web/active.md).

> **Local Sketchbook refinement, 17 October:** `redesign/sketchbook-refinement` builds on `f3bae05`. Home hierarchy, responsive chapter index and compact lesson tools are refined, with current services/grades/content and static Library behavior preserved. 138 frontend checks, lint/build and manual sample behavior/eight-width review pass. Connected Home/chapter read-only review preserves live progress. No new commit/push/deploy. [Refinement handoff](apps/web/SKETCHBOOK_REFINEMENT.md).

> **Current integration, 18 October:** PR #2 `df2de21` media and PR #3 `4290e0f`/`1ad4d58` Windows fixes are integrated locally with all three Sketchbook refinement passes on `redesign/sketchbook-refinement`. PR #1 is already in ancestry. 154 frontend/103 Python tests, lint/format/build and response contracts pass. Sample5195, connected5194/API8001 restarted; native sample narration/phase/legacy-diagram checks pass. No media bucket/publication or fresh authenticated live-data acceptance. No PR merge/closure, commit/push or deployment. This supersedes earlier “separate PR #2 build” integration guidance below. [Evidence and next step](docs/plans/sketchbook-pr-integration.md).

> **Current Library UI decision, 17 October:** extraction/text storage are internal. New uploads return directly to Library, which shows static filename/type/topic/date cards with Uploaded status and no detail actions. Paste/review/text-reader UI is removed; old text-reader links redirect to Library. Existing Firestore content and API contracts are preserved. User verified a real lecture PDF and its text in Firestore. 138 frontend checks, lint/build and connected responsive card review pass. User authorized commit/push of `feature/library-text-content` on 17 October. Final recheck: 138 frontend/94 Python tests, lint/format/build, Python→React contracts, OpenAPI consistency and production exclusions pass. Connected static Library reload verified; full browser suite not rerun. No deployment. Read [the current status](apps/web/active.md).

> **Text-only Library, 17 October:** local `feature/library-text-content` / `kiki-web-library-text` builds on redesign `2cfc241`. PDF/PPTX text extraction/review, authenticated JSON intake, atomic Firestore chunks and paginated reading are implemented. No original/media storage or billing change. Connected local build 5194/API8001; sample 5193. Live Google → API → Firestore text save/read/refresh/Library return now pass with one labelled synthetic English/Odia test entry. PDF/PPTX browser file selection remains permission-blocked. No new push. Read [the implementation/acceptance handoff](apps/web/LIBRARY_TEXT_CONTENT.md) and current status before continuing. PR #2’s in-progress build remains separate.

> **Local redesign, 17 October:** `redesign/engineering-sketchbook` starts at PR #2 `ba40218`, preserving the queued place saver and C-AM-08 Listen work. The user’s separate in-progress PR build stays separate. Read [the current status](apps/web/active.md) and [theme/integration handoff](apps/web/ENGINEERING_SKETCHBOOK.md) for the complete first visual pass and local preview on 5192. The user authorized commit and push of this source checkpoint on 17 October; deployment remains separate. The original integration checkpoint below is retained as history.

# Team handoff — 16 October 2026

Branch: `integration/connected-kiki-2026-10-16`.

This publishes the combined app reviewed with Akshita. It retains Arpan's cumulative ui/arpan-a11y history at 2256077 and adapts the connected work previously developed in Design-Thinking/apps. Existing kiki-web/main and Arpan feature ancestry are retained; the connected work is introduced by this integration commit. No existing remote branch is rewritten.

## Start here

- [Current frontend status](apps/web/active.md)
- [Student navigation](docs/ux/ui-slice-review.md)
- [React setup](apps/web/README.md), [Python setup](apps/api/README.md), [OpenAPI](apps/api/openapi.json)
- [Feature ownership](apps/web/ARPAN_HANDOFF.md), [current interfaces](docs/CONTRACT.md)

## Implemented

| Area | Current behavior |
|---|---|
| Account | Google-only Firebase sign-in, Python token verification, Firestore profile/enrollment, resumable onboarding and returning Home |
| Learning | Analog Modulation chapter map, four bilingual placards/concept, five-level language support, English/Odia glossary, saved places |
| Checks | Five questions/concept at 60%; ten-question chapter test at 80%; server assignments/drafts/grading/results and shared progress |
| Lab preparation | DSB-SC selection, seven-concept readiness, 12 checkpoint reading positions, saved student notes, owner-only continuation link, Home resume |
| Diagrams | C-AM-04 multiplication and accurate sideband spectrum; local frequency exploration and linked glossary highlights |
| Library | Browser-only sample originals; connected Firestore metadata list. Real cloud originals need usable private Storage |

Aditya owns later screen-share observation/assessment. Notes and reading do not verify experiment execution. No active Hey Clickky, verified lab completion, reviewed narration or assessed English/practical proficiency is claimed.

## Get this checkpoint

For a fresh review checkout:

```sh
git clone --branch integration/connected-kiki-2026-10-16 https://github.com/Kikiland-ai/kiki-web.git
cd kiki-web
```

For an existing clean clone, fetch origin and switch to integration/connected-kiki-2026-10-16. Keep ongoing feature work on its own branch.

## Run without Firebase access

Use Node 24.12 or later. From the repository root:

```sh
cd apps/web
npm ci
npm run dev
```

Open http://127.0.0.1:5173 → Open sample student. This labelled sample saves synthetic state in the browser only. There are no pre-seeded passes. Teammates can run it and all automated checks without cloud credentials.

## Run the connected app

Two terminals, each starting from the repository root:

```sh
cd apps/api
uv sync --locked --python 3.12
cp .env.example .env.local
# Configure your own approved keyless ADC identity; credentials are not in Git.
uv run uvicorn kiki_api.main:app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

```sh
cd apps/web
cp .env.example .env.development.local
# Fill approved public Firebase web configuration and remove the emulator URL.
npm ci
npm run dev:connected -- --port 5174
```

Do not overwrite existing local env files. Follow [Firebase setup](apps/web/FIREBASE_SETUP.md) and ask the project owner for approved backend access. The public web API key alone cannot authorize Python/Firestore. No shared login, ADC, private key or personal cloud-setup helper is included.

The connected catalog is already imported as am-51187527300cba2fa3cca868. Do not run a writing import to set up your laptop. Offline dry runs are available. Cross-device progress needs the same account/project; localhost links work only on the same computer.

## Validate locally

```sh
cd apps/api
uv sync --locked --python 3.12
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
```

```sh
cd apps/web
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
node scripts/check-python-learning.mjs
```

Run Python tests before the last command; they generate ignored public-contract receipts. Browser tests run the labelled sample, not real OAuth. If another checkout uses 5173, run `KIKI_E2E_PORT=5176 npm run test:e2e` to launch and test this checkout at that port. Production build excludes fixture stores and grading keys; local secrets stay ignored.

## Ownership and next work

Akshita: account/onboarding/Home/Profile/intake/Library/checks, router and service integration. Arpan: continuing learning/shared-kit/media UI ownership. Coordinate shared contracts/package changes. Aditya: deferred trusted observation/assessment; begin from [LAB_PREPARATION_CONTRACT.md](apps/web/LAB_PREPARATION_CONTRACT.md).

Next: review C-AM-04 Step 2 diagrams/glossary; settle reviewed narration content/provider before adding Listen. Storage, physical devices/hosting and Aditya integration remain separate dependencies.

## Provenance and scope

The data-model folder is the Analog Modulation source/runtime snapshot needed by tests and the importer. Design-Thinking remains the planning/content source; other courses/archive examples are not included. Required Kiki SVGs retain their paths in design-system/project/assets/Kiki. Keep source snapshots/version hashes coordinated when changing authored content.

Historical planning/acceptance notes are retained; apps/web/active.md is current. The original v0.3 contract is historical, not another runtime interface. Teammates must create their own local configuration; old machine paths/servers in historical notes refer to the original review machine.

The original working checkout, running servers, local env and unrelated Design-Thinking edits remain intact. This publication does not deploy an app, write Firebase records, change access or enable billing/Storage.

## Publication validation

A fresh dependency install in the integration worktree passed **80 Python tests**, **100 frontend unit/contract tests**, **67 browser tests** on its own port 5176 and **28 source-model tests**. ESLint, TypeScript/production build, Ruff lint/format, source-case validation and all ten Python→React response-envelope checks pass. npm reports zero dependency advisories. Production sample-store/private-grading-key marker checks and the staged-file credential/artifact scan pass. No existing local environment or cloud credential file was used by these tests.

The authenticated GitHub account is akshitanitr with push permission; the user explicitly selected akshitanitr for both author and committer. No assistant co-author is added. Live Firebase/browser acceptance described in apps/web/active.md belongs to the original connected review; it is not inferred from sample tests in this checkout.


17 October second refinement: Checks, quiz/results and Lab preparation are ready locally on `redesign/sketchbook-refinement`, including keyboard answer-save/question focus and a sticky lab save bar. 140 frontend tests, lint/build and sample behavior/8-width checks pass; connected review read-only. Both refinement passes remain uncommitted/unpushed. See `apps/web/SKETCHBOOK_REFINEMENT.md` (or `SKETCHBOOK_REFINEMENT.md` from this app folder) for integration guidance and verification limits.


18 October: third refinement completes welcome/sign-in/onboarding, subjects, upload/Library and Profile. Fresh local sample http://localhost:5195/; connected app 5194. 141 frontend tests pass with one worker thread, lint/build pass, recorded responsive and fresh-journey checks pass; existing connected Library contains three static cards. Full browser/file-picker/physical-device checks were not repeated. All three refinement passes remain uncommitted/unpushed on `redesign/sketchbook-refinement`. [Current refinement handoff](apps/web/SKETCHBOOK_REFINEMENT.md).
