> **Current, 18 October:** the full local UI pass is complete on `redesign/sketchbook-refinement`, including account/subjects/material/Profile, learning/assessments/labs and shared loading/recovery/dialog states. Review http://localhost:5195/ or connected http://127.0.0.1:5194/. Latest evidence and exact remaining dependencies live in [active.md](active.md); earlier checkpoint instructions below are history. PR work is deferred; no new commit/push/deployment.

> **Latest component pass, 17 October:** Home, chapter and lesson refinements are ready locally on `redesign/sketchbook-refinement`, based on the published Library feature `f3bae05`. Review the connected app on 5194 or sample on 5193. [Refinement changes and integration handoff](SKETCHBOOK_REFINEMENT.md). The first-pass checkpoint below remains published on its original branch.

# Engineering Sketchbook — local first pass

17 October 2026 · `redesign/engineering-sketchbook`

Base: PR #2 at `ba40218d7bf07637debe530019bcf8faf6afb61a`. The user clarified that the next build is **in progress on PR #2 and stays separate**. This worktree does not track or update that branch. The user authorized committing and pushing this source checkpoint on 17 October. Deployment remains separate.

## Open locally

The labelled browser-only review runs at **http://127.0.0.1:5192**. It uses this checkout's existing fixture services, with no preloaded passes or cloud configuration. The original connected checkout and both standalone design demos remain separate.

To restart, use Node 24.15+ and the existing lock:

```sh
cd apps/web
npm ci
npm run dev -- --port 5192
```

The server used for this review runs Node 24.21.0. No package/lock/configuration changes were necessary. Connected production still uses the existing authenticated composition root; the build does not introduce a sample fallback.

## Theme source and file map

| Source | Responsibility |
|---|---|
| `src/ui/theme.css` | Canonical neutral/dimension/plot colours, radius and shadows |
| `src/ui/fonts.css`, `src/ui/fonts/` | Locally bundled Space Grotesk and Noto Sans Oriya, four weights each, with OFL licences |
| `src/ui/styles.css` | Existing app primitives and responsive layout; imports fonts/theme |
| `src/ui/sketchbook.css` | App/account/setup/material/check/result compositions, imported after styles in `main.tsx` |
| `src/ui/learning/tokens.css` | Compatibility aliases to the same canonical values; learning components keep their existing APIs |
| Learning CSS Modules | Buttons, map entries, language dial, glossary/sheet, Listen and teaching pages |
| `features/home/LearningContinuation.*` | New view using existing `LearningApi` and `nextConceptId`, including loading/retry/ownership checks |
| `features/labs/LabPreparation.module.css` | Blue practical borders, checkpoint index and ruled note fields |

White reading surfaces, near-black `#111` ink, 1.5–2px structural outlines, small corners, selective 2–4px hard shadows. General primary actions are dark. Green marks concepts, red technical words, yellow academic English/language support, blue practical work. Saturated fills use dark text. Outcome remains written: passing, revisiting, reading and unassessed are distinct. Dark plots use `#131914`, `#79df95` traces and a local grid.

Kiki's SVG/dot identity, local icons and scientific SVG geometry stay editable. No presentation screenshots, new CSS framework, copied demo runtime or external font dependency is introduced. Legacy `design-system/project/tokens.json` is historical and must not regenerate this app over the canonical CSS.

## Route coverage

| Area | Existing routes/components | First-pass treatment |
|---|---|---|
| Welcome/account | `/`, `/auth`, `/onboarding` | Notebook illustration, bold headings, outlined choices, numbered setup and pressable actions |
| Home/subjects | `/home`, `/subjects`, `/subjects/:courseId` | Real learning continuation and check progress; separate resume/check/material sections and subject covers |
| Learning | `/learn`, `/chapters/:planId`, `/concepts/:conceptId` | Numbered chapter contents, current-page marker, four-page lesson margin, support dial, word sheets, dark waveform/spectrum and styled Listen |
| Materials | `/subjects/:courseId/material`, `/intake/:requestId` | Document form, dashed file area, processing/recovery/outline panels and original-source rows |
| Library | `/library`, `/library/:sourceId` | Material covers, original viewer frame, empty/error states |
| Checks | `/practice`, `/assessments/:assessmentId/new`, `/assessments/:assessmentId/:runId` | Check index, question/answer cards, saved-draft language controls, feedback, results/history and leave dialogs |
| Practical | `/labs`, `/labs/:sessionId` | Blue preparation cover, manual monitoring notice, twelve checkpoint controls, notes/save/continuation panels |
| Profile/errors | `/profile`, fallback/error/loading/connection screens | Shared type, controls, surfaces and outlined state screens |

Phone navigation has Home, Subjects, Learn, Checks and Library; Profile is the labelled initial button at the top right. Lab mode stays at the top. Learn remains selected for chapter/lesson routes, Checks for assessment routes. Navigation focuses main without jumping past the header and starts each new route at the top. Glossary closing retains its existing focus/scroll behavior.

## Consuming this with the other build

Preserve the in-progress build's behavior and apply the visual classes/wrappers to its latest components. The overlap is deliberately small:

- Shell navigation/route focus, Home's old subject continuation replaced by the new view.
- ChapterMap adds a body/contents wrapper and eyebrow; LessonScreen wraps the existing dial and labels the existing steps.
- LabHome adds its CSS scope; ResumeLab adds a class; material ready-state copy now describes curated sample lessons accurately.
- Remaining learning and practical changes are styles. `main.tsx` adds one stylesheet import and `index.html` removes remote font links.
- Tests add Home recommendation/ownership coverage, extend the token guard to the canonical file and intentionally change the prerequisite-link colour assertion from blue to ink.

Keep PR #2's queued `placeSaver`, language support, term focus handling, `AudioPlayer`, sample narration/provenance and synchronous auth cleanup. Do not resolve a merge by replacing the future build's LessonScreen with the older version here. Keep all imported CSS/font assets when adopting the aliases.

No contracts, DTOs, source lessons, catalog/version hashes, auth/services, backend, grading gates or fixture seeds changed. Five MCQs/concept at 3/5, chapter 8/10 after all ten concept passes, and the lab's seven prerequisites remain. Manual notes are not verified evidence. Narration stays explicitly sample machine voice, available only where clips exist. Uploaded originals and future monitoring keep their existing integration boundaries.

## Verification and limits

- ESLint, TypeScript/production build and **122 frontend unit/contract tests** pass (23 files). New Home tests cover returning to a saved concept without awarding passes and rejecting another learner's progress.
- Production output contains none of the checked fixture-store/factory or private `correctIndex` markers. Backend, authored data, package and lock files are unchanged; the original integration checkout remains clean.
- Browser review: welcome/sign-in, all four setup steps, enrollment, subject pages, real data-driven Home, chapter, C-AM-04 reading/resume, all five dial levels, glossary focus and phone sheet, correct 1900/2100 → 1800/2200 Hz exploration/reset, C-AM-08 Listen/languages/speed/term pause/placard cleanup, sample quiz submission/feedback, Profile save/reload and preparation Save and leave/resume.
- No page overflow at 320/360/390/430/768/1024/1280/1440px for welcome, Home, chapter, lesson, material form, Profile and lab preparation. All setup steps checked at 320px; quiz/result and term sheet reviewed at 390px.
- Populated upload/outline/original screens receive the shared styling, but could not be browser-retested: the Chrome extension blocks `FileChooser.setFiles` without its file-URL permission. No permission setting was changed. Existing material service/unit checks pass. Library empty state was inspected.
- Full automated browser suite and live Google/Firebase acceptance were not rerun in this worktree. No connected learner data was used or changed. Physical devices, browser text zoom and reviewed Odia/audio remain further acceptance work.
- Screenshots are local ignored review artifacts in `test-results/sketchbook/`.

This is a complete first visual pass, with component polish available for subsequent iterations. The user authorized source publication on 17 October to `Kikiland-ai/kiki-web`, branch `redesign/engineering-sketchbook`, with author and committer `akshitanitr`. Deployment remains a separate action.


17 October second refinement: Checks, quiz/results and Lab preparation are ready locally on `redesign/sketchbook-refinement`, including keyboard answer-save/question focus and a sticky lab save bar. 140 frontend tests, lint/build and sample behavior/8-width checks pass; connected review read-only. Both refinement passes remain uncommitted/unpushed. See `apps/web/SKETCHBOOK_REFINEMENT.md` (or `SKETCHBOOK_REFINEMENT.md` from this app folder) for integration guidance and verification limits.


18 October: third refinement completes welcome/sign-in/onboarding, subjects, upload/Library and Profile. Fresh local sample http://localhost:5195/; connected app 5194. 141 frontend tests pass with one worker thread, lint/build pass, recorded responsive and fresh-journey checks pass; existing connected Library contains three static cards. Full browser/file-picker/physical-device checks were not repeated. All three refinement passes remain uncommitted/unpushed on `redesign/sketchbook-refinement`. [Current refinement handoff](SKETCHBOOK_REFINEMENT.md).
