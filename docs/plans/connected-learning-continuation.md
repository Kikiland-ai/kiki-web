# Connected learner continuation

Status: Active

Last updated: 18 October 2026, India time

Current phase: first local implementation slice verified; media expansion and live acceptance remain

## Objective and success
Finish the existing connected learner and lab journey. Success requires the 40-placard coverage ledger, actual signed-in learning/audio/artifact/assessment continuation evidence, legitimate review/respond controls, bounded same-reservation recovery, and extension lifecycle regressions. Local tests and historical live checks are separate evidence.

## Context and scope
Implementation worktree: `kiki-web-continuation-2026-10-18`, branch `continuation/connected-learning-2026-10-18`, exact base/HEAD `44d2a0847a16b09fcdbfc865dcc5007f2d33a189`. Read-only backend source: `f2dca8b806e4002411b5704e19f0f40681093298`. Fetched origin for PR preparation on 18 October: main remains `b984c64bcff981d38c15edd3b6f2a7199feb4435`; PR #9 is open with head `44d2a0847a16b09fcdbfc865dcc5007f2d33a189` on `fix/lab-integration-small`. This PR is stacked on that branch so its diff includes only the continuation slice. User has now authorized commit, push and creation of this PR; merge/deployment remain separate. Original detached trial checkouts and dirty active records remain intact. Existing installed dependencies are reused by ignored symlinks; no environment configuration copied.

In scope: handoff workstreams A–D, preserving auth/services, source provenance and learner data. User authorized commit/push/PR publication on 18 October after local validation. No merge, deployment, IAM/billing/bucket creation, publisher apply, catalog import, learner reset, Mac lab backend, paid generation/capture or unrelated external messages. Operator controls sign-in and sharing. Akshita/Arpan ownership is preserved.

## Current-state evidence
[Machine-readable ledger](../evidence/concept-coverage-2026-10-18.json) contains 80 placard/language rows (40 placards), exact catalog/packet revisions, source hashes, recording scopes, expected/observed hashes and byte sizes, scene coverage, and separate connected/browser/cleanup status. All 80 source text comparisons PASS. All 22 recovered backend WAV paths contain LFS pointers: 16 placard clips and six concept recordings. Eight separate existing C-AM-08 English/Odia clips match their local provenance bytes. These are local availability checks, not audible/connected acceptance. Unsupported scenes remain incomplete. No private media bucket was configured in the prior trial; current connected configuration was not copied/read as part of this inventory.

## Workstreams and dependencies
| Workstream | Local next step | Completion signal | Dependency |
|---|---|---|---|
| A media | preserve compatible C-AM-08; extend trusted contracts/renderers after inventory | supported source-bound scenes and verified private audio | real backend LFS bytes, audio scope, approved existing bucket/publication |
| B journey | use per-placard ledger for actual browser walkthrough | signed-in lesson/audio/artifact/check/reload evidence | operator sign-in; media delivery; agreed assessment writes |
| C lab inputs | use authoritative criteria/response policy and current committed state | valid review/respond plus conflict/context regressions | policy/definition projection and controlled real lab work |
| D recovery | explicit pending code and one replay per Retry | dropped-response recovery keeps same execution | backend atomic creation/receipt remains independent |
| D extension | reproduce hello/generation/controller ordering | lifecycle and stale-response regressions; page/window coherence | canonical source ownership if defect is extension-side |

## Decisions and assumptions
Use the selected PR #9 source as compatible local base, without switching an existing checkout. Keep per-concept recordings explicitly scoped; never assign them to placards. Do not claim supported unknown renderer IDs. BB8 engineering files are reference guidance, not a registered runtime capability.

## Implemented and verified in this slice

- Reproducible offline inventory and reconciliation of older media documentation. Native C-AM-08 dry-run preserves revision `cm-e0f086007cc9f2062af093f3`, all eight clips and scene bindings.
- API GET identifies a replayable pending reservation with `code: lab_creation_pending`. Explicit browser Retry performs at most one POST with `recoverPending: true`. Server recovery requires an existing owned reservation and cannot allocate a new operation after its link disappears. Saved key/body never leave the server. Linked/completed records are read, legacy reservations fail closed, double-clicks coalesce, cancellation cannot open capture.
- Owner-protected `GET /lab-preparations/{prep_id}/execution/requirements` projects current backend `/lab-definition` and `/lab-guidance-policy`. Its definition checksum must match the linked execution; Python/Zod validate checkpoint/criterion IDs and response kinds. It writes no student evidence.
- Lab input UI exposes current criteria, student-written responses, optional confidence, explicit confirmation notes and current-visit required input. It adopts returned state/revision and refreshes the shared guidance publisher; drafts survive 409/422/503, are scoped to the original context and never auto-submit after a context/checkpoint change. It exposes explicit expected-condition declaration if needed (intent only; no simulator changes). Compact SSE decisions retain full-GET definition metadata/response history until the next full GET.
- Bridge IDs now survive controller remounts, hellos are single-flight, and late replies cannot undo superseded/closed-target events. Stale snapshot rejection fails closed. Disposing during a pending hello releases the controller, while an old publisher cannot send a tab-scoped bye for its replacement. Three new bridge regressions were run against original source and failed; all pass with the fix. This proves these web races, not exclusive causation of the historical paid-trial failure. Canonical extension code/build/permissions are unchanged; actual page/window coherence still needs a new controlled trial.

## Actual verification

| Check | Result | Scope |
|---|---|---|
| Offline audit script | PASS: 80 exact text comparisons; 22 backend LFS pointers; 8 separate web clips | no cloud/provider |
| C-AM-08 native publisher default dry-run | PASS, unchanged revision and 8 clips | no upload/publication |
| Web `npm test` | PASS: 208 tests / 38 files | units/contracts/doubles |
| Web `npm run lint`, `typecheck`, `build` | PASS | new checkout, locked installed dependencies reused |
| Web connected configuration checker | PASS: real Firebase settings | new source script, original configured working directory; no configuration values printed/copied; not OAuth acceptance |
| API `PYTHONPATH=src .venv/bin/python -m pytest -q` | PASS: 123 tests | deterministic cloud/upstream doubles; includes HTTP transport drop after upstream commit and same-execution replay |
| API Ruff check/format | PASS | src/tests/scripts |
| OpenAPI export and Python→React receipts | PASS | requirements receipt added; generated schema updated |
| Playwright `KIKI_E2E_PORT=5186 npx playwright test tests/lab-student-input.spec.ts --workers=1` | PASS: 5 tests | synthetic UI only, keyboard selection, failed-draft retry/context change; 320/390/768/1280px; screenshots visually inspected at 320 and 1280 |
| Canonical backend selected `test_lab_tracking.LabTests` tests | PASS: 4 tests | complete synthetic typed-response policy run, partial/duplicate review, expired image, foreign owner/duplicate criterion; fake analyzer, zero providers, no listening backend |
| New connected lesson/audio/artifact/assessment/browser lab trial | NOT RUN | operator/cloud/content prerequisites below |

Initial backend `.venv` lacked pytest/httpx; no packages were installed. The successful four backend policy tests used the existing web API Python interpreter with `PYTHONPATH=.:tests` in the canonical backend checkout. FastAPI tests emit the existing Starlette/httpx deprecation warning. No recorded test count is borrowed from the previous live trial.

## Now / Next / Later
Now: publish the user-requested PR for this verified slice, stacked on PR #9; use the source/byte ledger as the media implementation checklist. Aditya is handling the remaining work in parallel, per the user.
Next local work: implement remaining trusted recovered scenes with matching Python/Zod source bindings and meaningful scientific model regressions. The present slice adds no new renderer and does not claim Workstream A complete.
Next external work: [specific draft requests](backend-requests-2026-10-18.md) for existing audio bytes/audio scope, approved private delivery and atomic backend receipts. Requests are prepared, not sent.
Later: operator-controlled connected walkthrough, private media publication and complete twelve-checkpoint acceptance. Never substitute samples for those gates.

## Blockers and unblockers
- Backend owner: materialize the existing 22 content-addressed WAVs via LFS; expected hashes, sizes and concept/placard/language are in the ledger. Do not regenerate compatible recordings.
- Backend/web: choose explicit whole-concept scope support or supply true placard recordings for C-AM-04/05/06/07/09/10. No timing invention.
- Operator/cloud owner: supply an approved existing private bucket and existing identity permissions, then explicitly authorize publication. No automatic provisioning.
- Backend: make lab state and idempotency receipt one atomic durable operation; frontend replay cannot close its crash window.
- Operator: sign-in, intended MATLAB sharing and bounded analyzer authorization are needed for new live acceptance.

## Cold-pickup handoff
Last completed: first local implementation slice and actual checks above.
Current working state: this isolated branch is being published as a stacked PR over #9; original trial services/configuration and dirty worktrees are preserved. The exact published source commit is available from the PR head; the implementation base remains the revision recorded above.
Exact next: remaining trusted media renderer/contracts work from the ledger; after external prerequisites, run operator-controlled connected acceptance against the new source.
Do not repeat: historical trial acceptance or model calls; no new live acceptance has happened.


Final production scan: known synthetic UI/test markers absent; zero WAV files in production output. Locks unchanged; Git diff whitespace check passes. Original trial web still has only its two prior active-record edits; canonical backend still has only its prior active-plan edit. The test Vite server on 5186 exits with Playwright; original connected services were not restarted. The workspace continuation handoff links to this current plan.
