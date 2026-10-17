# Engineering Sketchbook redesign

Status: Complete — first visual pass · 17 October 2026

## Objective and success

Deliver the first Engineering Sketchbook pass across every existing React route. The user wants the complete application to share the locally reviewed design, with component refinement in later iterations. Work stays local on `redesign/engineering-sketchbook`, based on PR #2 head `ba40218d7bf07637debe530019bcf8faf6afb61a`.

Success means consistent Space Grotesk/Odia typography, white notebook surfaces, crisp outlines, hard shadows, dark general actions, semantic dimension accents and dark waveform plots throughout the actual app. Existing sign-in, onboarding, enrollment, materials, teaching, checks, lab preparation, preferences and error states continue to work.

## Context and decisions

- Design references: sibling `Kiki-Design-Language-Review-2026-10-17.md` and `Kiki-Sketchbook-App/`. These are design inputs; this branch retains the real React application.
- User confirmed Space Grotesk for an engineering personality, dark general primary buttons and blue reserved for practical work. White reading surfaces and Noto Sans Oriya remain.
- PR #2 already includes Arpan's non-blocking place saver, glossary focus/link fixes, dot colours and C-AM-08 sample Listen player. These are part of the base, not work to recreate.
- User clarified the next build is in progress on PR #2 and must stay separate. This checkout does not track that branch and will not merge future commits automatically. Repository handoffs are the available integration evidence; a separate future-build specification has not been supplied.
- Ownership stays Akshita for app/account/intake/checks and Arpan for learning/shared kit; Aditya owns later observation/assessment.

## Implementation plan

| Slice | Files/components | Completion signal |
|---|---|---|
| Foundation | `ui/styles.css`, canonical theme tokens, local licensed fonts, learning token aliases, both Button families | Stable shared colours/type/edges; no package or contract changes |
| App and account | `app/Shell.tsx`, Welcome, sign-in/setup, Home continuation, subjects, Profile | Desktop rail and phone navigation; real data-derived continuation; clear forms |
| Teaching | ChapterMap, MapNode, LessonScreen, DsbDiagrams, LanguageDial, Sheet, TermDetails, AudioPlayer CSS | Notebook composition; accurate dark plots; all five levels, saves, sheet focus and narration retained |
| Materials/checks/practical | Global page styles and LabPreparation CSS | Intake/review/Library/originals, attempts/results and manual preparation consistently themed |
| Verification/handoff | lint/typecheck/unit/build, browser route/responsive/keyboard review, `active.md`, student walkthrough, theme documentation | Recorded actual results and integration instructions |

## Compatibility and risks

No API, DTO, schema, source content, grading threshold, fixture seed, catalog version, auth or service-composition changes. Reading/notes are not mastery; unassessed dimensions stay unassessed. Preserve Listen availability, sample provenance, pause/cleanup and no autoplay before the student chooses Listen. Keep real cloud configuration out of this checkout; review the labelled sample on its own port.

Use a canonical token source with compatibility aliases, and explicit CSS Modules for learning. Avoid replacing components or refactoring state during the visual pass: the in-progress PR build should be able to retain its TS behavior and adopt these styles. Home uses the existing next-concept policy rather than a hard-coded lesson. Responsive checks include 320–1440px, long Odia and dialogs; reduced motion remains available.

## Now / Next / Later

- Now completed: shared foundation, page compositions, 122 unit/contract checks, lint/build and responsive browser review in this isolated worktree.
- Next: user review and component refinements; integrate alongside the in-progress build when that code is ready. The user authorized source publication on 17 October to the separate redesign branch; deployment remains separate.
- Later: component polish, reviewed narration, private originals/Storage, live monitoring and deployment stay separate.

## Verification and limits

See [the theme handoff](../../apps/web/ENGINEERING_SKETCHBOOK.md) for route coverage, actual checks and consuming-build guidance. Lint, TypeScript/production build and 122 frontend tests pass. Browser flow and eight-width checks are documented there. File chooser permission blocks rechecking populated material workflows; the app's permissions were not changed. No full automated browser suite, physical-device/text-zoom or connected acceptance is claimed.

## Cold pickup

- Last completed action: completed and verified the first visual pass, documented theme sources, navigation and compatibility, saved ignored review screenshots.
- Current state: completed source checkpoint on `redesign/engineering-sketchbook`, commit/push authorized by the user on 17 October; sample server at 5192. Original checkouts/connected servers and source data remain intact.
- Exact next action: review the local app and choose components to refine; when the separate build is ready, preserve its behavior and apply the small wrappers/styles listed in the handoff.
- Open first: this file, `apps/web/active.md`, `apps/web/ENGINEERING_SKETCHBOOK.md`, `TEAM_HANDOFF.md` and `apps/web/LAB_PREPARATION_CONTRACT.md`.
- Do not repeat: catalog import, connected learner setup, audio generation or PR #2's behavioral fixes.
- Rollback: use the unchanged PR head in another checkout; no cloud/data migration is involved.
