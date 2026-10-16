# DSB-SC lesson visuals

Status: Completed · 16 October 2026 · BB8 engineering implementation (repository reference guidance)

## Objective and success

Add readable, scientifically accurate C-AM-04 diagrams to the existing bilingual lesson: message × carrier → signed DSB-SC waveform, plus positive-frequency spectrum with actual-position lower/upper sidebands and no separate carrier line. Link technical terms to highlighted diagram targets and the existing Odia glossary sheet. Laptop/phone, keyboard, reduced-motion and saved lesson/quiz state stay usable.

## Sources and decisions

The existing Firestore sourceConcepts/C-AM-04 contains the authored visual/parameter-sweep specification: fm default100/min10/max200/step10 Hz; fc default2000 Hz. Derive a small allowlisted optional lesson.visual DTO from that already-versioned source. Do not rewrite the immutable catalog or change content versions/grades merely for this presentation addition. Fixture export uses the same pure projection; connected mode never substitutes fixture content.

Public visual contains only renderer kind/revision, Hz baseline/range, required term IDs and source refs. No formulas are evaluated as code. The renderer implements known analytic sine/cosine/product formulas; main spectrum is positive-frequency and normalized, under ideal single-tone zero-mean assumptions. Local parameter changes are exploratory, not saved evidence or live simulator traces.

No new narration, Listen/Watch simulation, speech service, Aditya monitoring, pointer, lab execution, Storage, billing, IAM, deployment, commit or push. Original source JSON and Arpan components remain intact; generic term chip gains an optional context slot/callback usage only.

## Now / Next / Later

1. Now: additive Python/React visual DTO and projection from stored authored source; unit/schema checks and unchanged catalog/progress.
2. Next: accessible responsive SVG/HTML diagrams, source-driven local frequency control, linked glossary highlights and meaningful numerical/browser checks; live Google lesson review.
3. Later: instructor/Odia review and reviewed narration/synchronization. More concept diagrams after this slice is reviewed; Aditya owns later software monitoring/assessment.

## Verification and cold pickup

Check 100/2000→1900/2100; alternative message frequencies and bounds; absence of a carrier spectral stem; equal normalized sidebands; signed waveform; no page overflow 320–1440; glossary keyboard/focus; all dial levels and unchanged mastery. Test actual geometric/data placement, not just selected state. Record actual results in apps/web/active.md.

Last completed: additive source projection, responsive Concept/Application renderer, local frequency exploration, linked glossary context and actual Google/Firestore lesson review. Verified 80 Python / 100 frontend / full 67 browser checks, actual response contracts, lint/typecheck/build/OpenAPI and BB8 checks. Catalog version unchanged; no cloud-content or source-data mutation. First browser animation-timing assertion corrected to wait for sheet bounds; full rerun passed. Exact next: student reviews C-AM-04 Step 2; prepare reviewed narration assets/provider before implementing Listen. Aditya monitoring remains deferred.
