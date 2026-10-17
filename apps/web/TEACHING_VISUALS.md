# DSB-SC teaching visuals

16 October 2026 · C-AM-04 · presentation addition to the connected lesson

## Student route

Open Learn → Concept 4: DSB-SC generation and sidebands → Step 2 (Concept). Step 3 (Application) also includes the diagrams. The four placards, language support, saved place and concept check keep their existing roles.

The first figure multiplies a zero-mean message by a carrier and plots the signed Product output over 0–20 ms. The second figure is a positive-frequency, equal-height normalised spectrum. At fm=100 Hz and fc=2000 Hz its stems lie at 1900 Hz and 2100 Hz. A hollow marker on the frequency axis identifies 2000 Hz; it is not a carrier spectral line.

Message frequency is a local 10–200 Hz control, in 10 Hz steps, with reset to 100 Hz. The carrier stays at 2000 Hz. Waveforms, stem positions, accessible descriptions and frequency readings update together. Exploration is not saved, does not change lab settings and does not award mastery or language/practical evidence.

Sideband, carrier and DSB-SC chips open the existing English/Odia term sheet, followed by the relevant diagram context. Closing restores keyboard focus and leaves a labelled diagram highlight. Clear diagram highlight removes it. Existing lesson text/word-list chips also select the corresponding target. No audio playback or media generation was added.

## Python → React boundary

The existing authenticated GET /concepts/C-AM-04/lesson adds optional lesson.visual with schema dsb-sc-visual/v1. Python projects allowlisted defaults/range, renderer kind, glossary IDs and source references from the active version's sourceConcepts/C-AM-04. React validates that DTO and its glossary references before rendering a known analytic model. Source strings are never evaluated as formulas or markup.

The immutable imported catalog stays am-51187527300cba2fa3cca868. No reimport, head change, new database document, progress migration, credential or rules change is needed. Other lessons omit visual. The fixture export script uses the same pure projection, but only the explicit sample-mode module imports that JSON; connected mode has no fixture fallback.

Implementation: API teaching_visuals.py / learning.py; web contracts/teaching-visual.ts, features/learning/DsbDiagrams.tsx and dsb-math.ts. Export public preview with apps/api/.venv/bin/python scripts/export_teaching_visual.py from apps/api. Regenerate OpenAPI with scripts/export_openapi.py.

## Evidence and limits

Tests verify the numeric sidebands, actual SVG stem coordinates, signed waveform, absent carrier stem, range bounds, glossary/focus and responsive 320–1440 px layouts. The actual Python response is checked against React's runtime schema. API tests assert an unchanged catalog version and no read-side database writes.

Connected browser review verifies the real Google/Firestore lesson and its frequency control/Odia term sheet. Phone-sized browser emulation is not physical-device acceptance. Authored content remains draft; expert/Odia review and reviewed narration are still pending. These are teaching calculations, not live Simulink output. Aditya's observation/assessment and Hey Clickky integration remain deferred.

Rollback: remove the optional render/projection and regenerate the public contract; no database rollback or student progress reset is involved. Current counts and exact next action live in [active.md](active.md).

## 17 October — renderer registry

The DSB-SC diagrams are now the first entry (`dsb-sc-visual/v1`) of the trusted renderer registry in `features/learning/scenes.tsx`. They have the same projection, placement and behavior. Published scenes (first: C-AM-08 `coherent-phase-recovery/v1`) use the same registry. See [CONCEPT_MEDIA.md](CONCEPT_MEDIA.md).
