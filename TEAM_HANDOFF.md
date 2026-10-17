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
