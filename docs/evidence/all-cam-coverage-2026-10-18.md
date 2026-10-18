# All-ten CAM consumer results — 18 October 2026

[PR #12](https://github.com/Kikiland-ai/kiki-web/pull/12) is open into `main` from `integration/all-cam-2026-10-18`, after user-authorized merging of #9/#11/#10. Implementation source `dc7a403cb7a089042bdaf336444e5aaa00ae147a` started from exact base `fa87fb61c6b0dd27658ffc495bcb8d74a243ce4c`; tested integrated source `bd3a8be7f0706915bb36732bd8136b823fd85c44` includes main `7eb394592f3cf6a56f981363e9ee490c89c0b651`. Commits are authored/committed/pushed as verified `akshitanitr`. PR #12 remains unmerged. Original trial source/configuration/services and pre-existing dirty records remain preserved. No deployment, media publication or cloud/learner changes.

Publication validation on combined main: **236 frontend tests / 40 files**, **145 API tests**, lint/typecheck/build, Ruff check/format, exact OpenAPI, all-ten Python→React receipts, 38 model cases, native C-AM-08/lockfile preservation and connected production exclusions PASS. **13 final serial browser cases PASS**, all ten plus preference/legacy/missing-language regressions. The initial-phase counts and transient failures below are retained as history. Merging #10 required documentation conflict resolution only; its combined 213 frontend/124 API/21 browser checks and API/web CI passed before merge. Backend PR #7 remains open.

Archive SHA-256 `13a58628c0bdb383642ac45d949dcf1d563cb99d7b3bb0a93e484298e5dc83a9`: exact membership, safe extraction and all 77 declared sizes/hashes PASS. Source producer is a local uncommitted backend candidate based on `f2dca8b806e4002411b5704e19f0f40681093298`; this does not establish running-backend provenance. All 26 original WAVs verify hash/size/format/duration. The supplied model verifier passes ten concepts/38 cases/zero provider calls. [Code/scene provenance](../../data-model/media/cam-contract/README.md).

## Every concept

Local PASS means: Python schema/binding/bytes/authenticated API doubles; actual Python response parsed and paired by React; renderer/control/reset/model tests; explicit sample browser journey across four placards, language availability, playback/pause/seek/speed/cleanup, keyboard/reset/mobile widths, assessment feedback, saved position/dial and reload. It does not mean real signed-in delivery or content approval. [80 exact source/language rows with individual hashes and scope](all-cam-coverage-2026-10-18.json).

| Concept | Immutable candidate revision | Artifact | Original recordings | Local checks | Real connected acceptance |
|---|---|---|---|---|---|
| C-AM-01 | cm-bbb2e0a4310f0c9690b7af73 | signal | 4 Odia placard clips | PASS | BLOCKED / NOT RUN |
| C-AM-02 | cm-4cbb178d9e769c8be4aa8fc1 | flow | 4 Odia placard clips | PASS | BLOCKED / NOT RUN |
| C-AM-03 | cm-b9246b4bcdb0692952488b69 | am | 4 Odia placard clips | PASS | BLOCKED / NOT RUN |
| C-AM-04 | cm-d64abd1d5bc83b2c8e039a56 | dsb | 1 Odia whole-concept clip | PASS | BLOCKED / NOT RUN |
| C-AM-05 | cm-e951291ded75b2243b041356 | spectrum | 1 Odia whole-concept clip | PASS | BLOCKED / NOT RUN |
| C-AM-06 | cm-689991a261beba2edbf30db8 | receiver | 1 Odia whole-concept clip | PASS | BLOCKED / NOT RUN |
| C-AM-07 | cm-973f77077e8827dbd2e4c87b | filter | 1 Odia whole-concept clip | PASS | BLOCKED / NOT RUN |
| C-AM-08 | cm-e0f086007cc9f2062af093f3 | native phase recovery | 4 English + 4 Odia placard clips | PASS | BLOCKED / NOT RUN |
| C-AM-09 | cm-f7305fdd8e01eb36e2fe3fa3 | fm | 1 Odia whole-concept clip | PASS | BLOCKED / NOT RUN |
| C-AM-10 | cm-d0206eaf5b6f064770261fbe | pm | 1 Odia whole-concept clip | PASS | BLOCKED / NOT RUN |

The native C-AM-08 manifest equals the existing package exactly, including revision, native artifact and eight recordings; its publisher default dry-run returns `cm-e0f086007cc9f2062af093f3`. Original native source/fixtures/assets have no diff. The shared model supports all ten kinds; C-AM-08 still selects its native renderer. C-AM-04 common slots suppress duplicate legacy diagrams; the legacy fallback remains tested.

## Actual verification

- API: `PYTHONPATH=src .venv/bin/python -m pytest -q` — **144 PASS**, including 21 all-CAM tests and all 26 private byte deliveries through in-process authenticated API/store doubles. Existing Starlette/httpx deprecation warning remains. Ruff check/format PASS.
- Frontend: `npm test` — **231 PASS / 39 files**; typecheck, lint and connected production build PASS. All **38** numerical cases pass through the byte-identical vendored consumer.
- `node scripts/check-python-learning.mjs` — existing receipts plus all ten actual metadata-only lesson/manifest responses PASS. With object storage absent, published metadata remains 200 with `audioAvailable: false`; private asset requests remain 503, unauthenticated 401 and unenrolled 403. GETs do not mutate state.
- Broad sample Playwright command covering all-CAM, concept-media, DSB, learning and assessments: **62/65 PASS initially**. Two initial media-clock checks stalled while Python, Vitest, screenshots and browser tests ran concurrently; the cause is not conclusively proved. One older test incorrectly expected no C-AM-01 audio and was updated to check unavailable English narration. Final serial command `KIKI_E2E_PORT=5187 npx playwright test tests/all-cam.spec.ts tests/learning.spec.ts --grep 'C-AM-|unavailable narration language' --workers=1`: **11/11 PASS**, all ten concepts plus that regression. No known failed case remains; a fresh single 65/65 broad run was not claimed.
- Earlier browser verification exposed an actual controlled seek-input defect: seeking changed the media time but React's displayed range value lagged. Updating both states fixed the reproduction. Blob revocation assertions now wait for React's passive cleanup rather than racing it. Both behaviors pass the final suite.
- 320/390/768/1280px fit and keyboard controls pass all-ten browser checks. Twenty synthetic sample screenshots (390/1280px, every concept) and two contact sheets were visually inspected; generated diagnostics stay ignored under `apps/web/test-artifacts/all-cam-visual`. This is browser evidence, not a physical phone/speaker acceptance test.
- Production output contains no WAV/MP3 files, candidate audio hashes, fixture store markers or assessment answer keys. The existing sample-entry text is present behind the existing runtime fixture-mode guard; `create-services.ts` imports fixture modules only under `import.meta.env.DEV`. No sample records/bytes or silent fallback are bundled into connected services. Lockfiles are unchanged.

## Remaining gates

**BLOCKED — publication and private delivery.** No candidate revision/head was published or activated and no cloud/IAM/billing/storage configuration was changed. The inspected trial has no private audio bucket configured. An authorized operator must coordinate candidate publication through the existing v1 publisher, configure approved private storage/access and run real signed-in lesson/manifest/audio/artifact/check/save/reload/sign-out acceptance against the intended web/API/backend revisions. No catalog reimport or learner reset is required. In-process test publication is a memory double, not a cloud operation.

**NOT RUN — physical listening/device acceptance.** Browser clocks prove decoding and playback progression; they do not establish speaker output, pronunciation, spoken fidelity or native-device behavior.

**PENDING — content quality.** Scientific, native-Odia, pronunciation, spoken-fidelity and audio-quality reviews retain their original pending states. English narration is absent in nine concepts (36 placard/language rows); the UI truthfully states absence. No paid regeneration, sentence alignment, splits or invented timestamps were performed.

**Saved-model limitations from decision 0013:** C-AM-01 draws two traces although its brief describes three. C-AM-04 fixes carrier frequency at 2000 Hz although the authored interaction also describes adjustable fc. FM/PM use normalized teaching waveforms and are not simulator settings. These remain visible and require deliberate content review; this compatibility work does not settle them.

[Implementation and commands](../plans/all-cam-integration-2026-10-18.md) · [Current frontend record](../../apps/web/active.md) · [Student walkthrough](../ux/ui-slice-review.md).
