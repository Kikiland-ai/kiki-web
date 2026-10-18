# Preprocessed concept media

## Current coverage audit — 18 October 2026

The [current offline coverage ledger](../../docs/evidence/concept-coverage-2026-10-18.md) supersedes older statements below about absent recordings. Recovered backend source `f2dca8b806e4002411b5704e19f0f40681093298` contains metadata for 22 recordings: 16 per-placard Odia clips for C-AM-01/02/03/08 and six whole-concept Odia recordings. In the Mac source checkout all 22 WAV paths contain LFS pointers; three of those hashes also exist in the separate web C-AM-08 package. That package's eight English/Odia clips remain intact and its native publisher dry-run still verifies the same revision. The other recovered scenes are not implemented by this web slice. Current trial configuration has no private media bucket. Connected listening/artifact acceptance remains NOT RUN; no new media is published or generated.

## Sketchbook integration — 18 October 2026

This package is now integrated locally into `redesign/sketchbook-refinement` with the static text-backed Library and all three component refinement passes. The phase scene uses the shared dark Signal Studio plot tokens and neutral Sketchbook controls. PR #2 source revision `df2de21`; PR #3 Windows fixes also applied. 154 frontend/103 Python tests and shared response contracts pass; native sample narration/phase checks pass. No bucket configured, media published, GitHub PR merged or source pushed in this integration. See [the integration evidence](../../docs/plans/sketchbook-pr-integration.md) for scope and remaining gates.

17 October 2026 · C-AM-08 first package · follows the next-build handoff on PR #2 (comment 6222578532)

Topic/concept + versioned English source → existing mixed-language/TTS output + a compiled interactive scene → a validated, versioned package → the existing frontend fetches and plays it. Media is prepared ahead of lesson viewing. A lesson GET only reads what was published; it never generates.

## What a learner sees

Open Learn → Concept 8: Carrier mismatch and debugging.

- **Listen** appears on all four placards. It plays the API-delivered English or Odia clip for the text on top of the card (same dial rules as before). Play/pause, seek, 0.75/1/1.25× speed, the notch-3 language switch, term-sheet pause and sign-out stop are unchanged. The player opens straight away. It shows "Loading narration…" while the private clip downloads. A failed download offers Retry.
- The player always says **Sample audio · machine voice, not reviewed**. It also states the timing limit: the clip plays the whole step and no words are highlighted, because there is no sentence timing.
- **Step 2 (Concept)** and **Step 3 (Application)** show C-AM-08's own phase-recovery scene:
  - Relative phase error control: 0–180°, steps of 15°, lesson example 60°.
  - The aligned and recovered message traces.
  - The signed recovery fraction cos φ.
  - The lesson's 0/60/90° comparisons.
  - Reset.
  - A separately labelled note that the finite-filter residual is not modelled.

  Exploration is local. It saves nothing, changes no lab settings and awards no mastery.
- C-AM-04 keeps its DSB-SC diagrams. They are not reused as C-AM-08's visual.
- No media, unconfigured storage or a rejected manifest leaves the complete text lesson. A rejected manifest also shows a note with Retry.

## Contract (Python `media_models.py` ↔ React `contracts/concept-media.ts`)

`lesson.mediaExperience` (optional, `media-experience/v1`) is a small pointer:

- `catalogVersion`, `mediaRevision` and `release` (`sample_unreviewed` | `reviewed`).
- The placard/language pairs that have narration.
- The artifacts with their renderer IDs and placard slots.

Text-only lessons omit it. `lesson.media` and `lesson.visual` are unchanged.

`GET /concepts/{conceptId}/media` → `{manifest}` (`concept-media-manifest/v1`, immutable). It holds:

- **Revisions:** `catalogVersion` (content), `mediaRevision` (media), and a speech model revision per clip: provider, model, voice, style, generator, generatedAt.
- **Per-placard/language renditions:**
  - `renditionId` = `{placardId}.{lang}`.
  - A content-addressed `assetId` (= `audioSha256`), MIME type, bytes and duration.
  - `sourceTextSha256`: the exact placard text in that language.
  - `speechScriptSha256`: the spoken script, with formulas expanded.
  - `narrationKind`.
  - Review: pronunciation, native Odia, spoken fidelity and audio quality. Each is pending, accepted or rejected; `reviewed` only if all are accepted.
  - Timing: `clip_duration_only` / `alignment: not_performed`. There are no sentence timestamps until evaluated alignment exists.
- **Artifacts:** a trusted renderer ID, placard slots, and the authored prompt. They also carry:
  - Parameter bounds and units.
  - Comparison values.
  - Source references.
  - Source-to-scene bindings: SHA-256 of the authored `interactive` and `textImage.visual` sections.
  - Behavior tests: inputs → expected output ± tolerance.
  - Scientific review status.
  - `claim: ideal_teaching_model`, never lab verification.

`GET /concepts/{conceptId}/media/{mediaRevision}/assets/{assetId}` returns the verified private bytes with `Cache-Control: private, no-store` and `nosniff`.

Both routes have the same requirements as lessons: a verified Google identity, an existing enrollment, and the configured API base. Ownership comes from the token UID. The browser never reads Firestore or Storage directly. There are no public media URLs. The browser fetches each clip with the bearer token when Listen is pressed. It checks size and SHA-256, then plays a revocable `blob:` URL. Over a plain-HTTP LAN address only the size is checked, because `crypto.subtle` needs a secure context; the API has already verified the hash. Leaving the lesson, changing account or signing out revokes every clip.

**Binding checks, Python and React.** Each rendition must match the current placard text hash. Each scene must match the current authored source hashes and placards. The manifest must be the exact revision the lesson pointed to. React keeps unknown renderer IDs as "unsupported" and shows a quiet note; it never executes them. A corrupt known renderer, invented timing or a reviewed release with unreviewed media is rejected.

**Trusted renderer registry** (`features/learning/scenes.tsx`):

| Renderer | Data source | Notes |
|---|---|---|
| `dsb-sc-visual/v1` | C-AM-04, from the existing `lesson.visual` | First entry; its projection and placement are unchanged |
| `coherent-phase-recovery/v1` | C-AM-08, from the manifest | Draws only after the app's own cos φ model reproduces the manifest's behavior tests |

Authored strings are never evaluated: the projection accepts only the exact authored formula `cos(phi*pi/180)` and binds it to the known model.

## Storage and publication (`apps/api/src/kiki_api/concept_media.py`)

| Where | What |
|---|---|
| `data-model/media/C-AM-08/` | Package source: the eight existing clips (moved from `apps/web/public/audio/sample`) and their provenance. Only the `file` paths in the provenance changed |
| Firestore `conceptMedia/LP-ANALOG-MODULATION/catalogVersions/{catalogVersion}/concepts/{conceptId}` | Head: `currentRevision` |
| Firestore `…/concepts/{conceptId}/revisions/{mediaRevision}` | Immutable revision: public manifest + internal asset index (object path, MIME type, bytes). About 12 KB for C-AM-08 |
| Object storage `concept-media/LP-ANALOG-MODULATION/assets/sha256/{sha256}` | Content-addressed private audio; create-only, SHA-256 metadata, `private, no-store` |

Media revisions sit **beside** catalog `am-51187527300cba2fa3cca868`, not inside it. The catalog, its head, learning states, positions, passes and assessment history are untouched. Learner state stays keyed by catalog version only, so adding or replacing media resets nothing.

`scripts/publish_concept_media.py [C-AM-08]` builds the package from the committed clips and the same authored catalog the importer uses, then prints the revision. The build checks that, for every clip:

- The WAV is complete 24 kHz mono 16-bit and not silent.
- Bytes, SHA-256, duration and peak match the provenance.
- The speech-script hash matches.
- The display-text hash equals the current placard text.
- No timing cues are claimed.

It is a dry run by default. `--apply` (with `--bucket` or `KIKI_MEDIA_BUCKET`, and `--expected-current` when replacing a revision) does three things:

- Refuses unless the active catalog is the package's version.
- Uploads create-only assets.
- In one Firestore transaction, creates the immutable revision and moves the head. A repeat is `unchanged`; a different revision under the same ID conflicts.

C-AM-08 currently packages to `cm-e0f086007cc9f2062af093f3`.

**Storage is not active.** The documented default bucket is absent and no billing upgrade is authorized (`../api/STORAGE_SETUP.md`). Without `KIKI_MEDIA_BUCKET`, the API serves text-only lessons and the manifest route returns 503. Do not create a bucket, grant IAM or make media public to enable this.

Once an approved private bucket and access exist:
1. Set `KIKI_MEDIA_BUCKET` for the API: object viewer for the API identity, object creator for whoever publishes.
2. Run the dry run, then `--apply`.
3. Verify the signed-in steps below.

## Sample mode and build isolation

`npm run dev` (sample mode) uses `fixtures/media.ts`. It serves the identical manifest, exported by `scripts/export_concept_media_preview.py`, and reads the same committed clips from `data-model/media` through Vite's dev file allowance. It goes through the same verification and blob path as connected mode. Connected builds never import the fixture module.

The production `dist` is now about 0.8 MB with **no WAV files** (previously 8.8 MB, nearly all sample clips under `public/`). The hard-coded `src/media/narration.ts` lookup and the placeholder-clip script are removed. Connected rendering has no silent sample fallback: missing connected media means text only.

## Verification (17 October)

- **Python:** 9 new tests (`tests/test_concept_media.py`):
  - The package binds every clip to the exact text, script and audio, with a deterministic revision.
  - Changed text, changed bytes and a wrong WAV format are rejected.
  - The scene is projected only from the authored source; unit, formula and concept changes are rejected.
  - Publication is atomic and idempotent, adds exactly two Firestore documents and leaves the catalog and a saved position intact.
  - Media must bind to an imported catalog.
  - A lesson read gains the pointer but writes nothing; C-AM-04 is unchanged.
  - Manifest and bytes are rejected for no token (401) and no enrollment (403); unknown asset or revision gives 404; tampered bytes give 503.
  - A stale text hash or unconfigured storage falls back to text.
  - Receipts are written for React.
- **React:** unit tests for the contract, connected adapter (bearer, no sample fallback, verified bytes, revocation), narration cache (once per lesson, retry, abort + release on close), phase model/behavior tests and player loading states.
- **Python → React:** `scripts/check-python-learning.mjs` validates the actual media lesson and manifest receipts, the lesson↔manifest pairing, and that every published scene has a renderer.
- **Browser (sample mode, installed Chrome):**
  - The existing Listen tests now assert the published rendition (`data-media-id`) and `blob:` playback.
  - New `tests/concept-media.spec.ts`: the scene's numbers and placement; no saved state from exploration; place kept on reload; the clip URL revoked on leaving the lesson; a 503 clip fetch keeps the text and recovers on Retry; C-AM-04 diagrams and no audio there; fit with 44px+ controls at 320/390/768/1280px.
  - axe: 0 violations at 390 and 1280px with the player playing over the scene (`browser-checks/check-concept-media.mjs`).

**Not verified:**
- Live connected publication or a real signed-in fetch: needs approved storage.
- Actual phone playback.
- Native Odia, pronunciation, spoken-fidelity, audio-quality and scientific review.

## Remaining handoff steps

4. **Durable preprocessing**, the backend media workstream. Wrap the existing kiki-backend generators in resumable stage jobs with:
   - Exact-version caching and idempotency.
   - Bounded retries and provider load.
   - Atomic publication. `publish()` is the atomic step to reuse.

   Prepare all ten Analog Modulation concepts before expanding scope. See the current inventory above for existing recordings, their real-byte availability and the whole-concept/placard contract gap; do not regenerate compatible assets. The job store and queue are undecided (`kiki-backend/docs/architecture/mixed-language-fastapi.md`).
5. **Opt-in continuous reading, guided states and evaluated sentence alignment.** The contract's `timing.kind` is the extension point. Do not add timestamps until alignment is evaluated.

The 15 diode/material-balance/eigenvalue concepts need course/catalog/schema generalization first. The Python and Zod contracts still fix `planId` to Analog Modulation.

Rollback: stop setting `KIKI_MEDIA_BUCKET`, or move the concept head back to an earlier revision with `--expected-current`. Lessons fall back to text. No catalog or learner rollback is involved.
