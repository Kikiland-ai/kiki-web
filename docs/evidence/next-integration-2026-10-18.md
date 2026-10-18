# Next web integration evidence

18 October 2026. Base/unchanged HEAD:
`15628669372853d1165ed6a97474c4a0608bfc9d` (PR #12 merged), initially clean.
Local changes are uncommitted. Parent frontend/API active records are current.

## Local checks

| Scenario | Result | Evidence boundary |
|---|---|---|
| Bundle and preservation | PASS | 69 outer/77 inner hashes; 10 records, 26 WAVs, shared model, native C-AM-08, canonical extension files equal |
| Shared CAM/v1 and private API | PASS | Existing main; 145 API tests with store/asset/identity doubles, all ten metadata-only and protected-byte cases |
| All-ten learning | PASS | 10 parameterized sample browser journeys: four placards, languages, real original sample WAVs, controls/reset/keyboard/mobile, quiz feedback, position/reload/return and cleanup |
| Student input UI | PASS | Five sample browser cases including 320/390/768/1280px, retained failed/stale drafts and explicit selection |
| Twelve checkpoint path | PASS | Actual React capture controller/API/backend; synthetic identity/store/MockTransport; response kinds, explicit criteria/conditions, all twelve done, unassessed completion and reload |
| Lost create response | PASS | Actual upstream create then injected response loss; reload and explicit recovery POST reuse the same lab; explicit Share still required |
| Delayed Pause/floating Resume | PASS | Final GET held deterministically; Resume waits, revisioned writes stay ordered, target/page guidance agrees |
| Queue cancellation | PASS | Unit regressions for Stop/sign-out/disposal/new Share; delayed error-refresh result cannot overwrite replacement guidance |
| Mount/recheck/replacement | PASS | Native browser initial/three rechecks and route remount; deterministic actual-script StrictMode overlap/late reply harness |
| Worker restart | PASS | Native browser CDP closes background target; subsequent hello ack retains stream/generation; deterministic session storage test |
| Another reader | PASS | Native browser prior tracks end; old controls/replies fenced; replacement requires explicit Share |
| Target reload/reopen/sign-out | PASS | Native synthetic tab/browser; no automatic sharing and all tracks ended |
| Now/Next/revision/masks | PASS | Rendered text and target revision ack agree; positive unmasked canary and negative pre-encoding mask controls; unsafe samples not encoded |
| Schema/build/production | PASS | Lint/typecheck/build, Ruff/format, exact OpenAPI, Python→React receipts; production excludes synthetic identity/store/answer markers and WAVs |
| Model conformance | PASS | 38 cases across all ten supplied model kinds, zero providers |
| Extension deterministic lifecycle | PASS | Eight actual-script tests including current TypeScript publisher |

Five canonical-extension lab browser cases pass together. Final counts and per-file
hashes are in the exported `WEB-INTEGRATION-STATUS.json`. A final late-error guard
was additionally checked by a focused regression and repeated affected capture cases.
No paid provider or real learner/capture was used. In-memory fixture state is separate
from production; tests have no connected-mode fallback. Native capture here targets
only the synthetic browser tab, not a real MathWorks account.

Initial attempts retained during work: default Windows text decoding failed until
UTF-8 mode; concurrent Playwright result directories collided; new tests initially
sampled a handshake before it completed, raced route commit, used overly exact
label matching and expected a new-worker event. Test transitions now wait for actual
UI/protocol acknowledgement; result directories are separate. No production timeout
or stale/revision/auth guard was relaxed. A harmless Windows connection-reset message
appeared during test socket cleanup in the passing five-case run.

## Remaining connected and release gates

| Gate | Status and exact unblocker |
|---|---|
| Live backend/tunnel | Latest receipt is stopped and localhost8100 refuses health. Owner must provide fresh running receipt/authenticated smoke and recheck existing Mac listener. No restart here. |
| Real signed-in all-ten learning | Pending approved private bucket/API delivery configuration, guarded publication, real account and Mac browser acceptance. Sample byte playback is not connected acceptance. |
| Real twelve-stage MATLAB | Pending explicit student capture/provider trial authorization and live candidate; synthetic progress is unassessed and proves no proficiency. |
| Intended project | Latest correction is KiKi / kiki-512012, superseding old builder-cup-a8479 references in archives. Read resource/access inventory and coordinate frontend/Auth/verifier/datastore/bucket cutover; no silent copy/reset or live config switch. |
| Durable release | Shared lab/ticket state, service authentication, private delivery and deployment planning remain separate. No cloud/provisioning/publication/IAM/billing/deploy changes. |

Fresh on-disk backend provenance matches PR #7 base
`f2dca8b806e4002411b5704e19f0f40681093298`, dirty candidate, 244 files, hash
`cba63acd35bdb222070b7fb63c84c00a5a628769e125543d865c64866e480cb0`.
The old startup smoke 9/9/zero-model receipt is historical startup evidence only.

Supplied user-confirmed content review is reported provenance, not an independent
review performed here. Immutable review metadata is preserved. Nine concepts lack
English audio, no sentence alignment exists, and saved-model limitations remain
visible. No content generation or review-hash rewrite occurred.
