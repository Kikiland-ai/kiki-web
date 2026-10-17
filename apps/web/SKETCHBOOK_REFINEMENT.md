# Engineering Sketchbook component refinement — 17–18 October 2026

> **Published:** `e951a83` on `origin/redesign/sketchbook-refinement`; [PR #5](https://github.com/Kikiland-ai/kiki-web/pull/5) into `main`. The local-only statements below describe earlier checkpoints. No deployment; older PR closure waits for merge and fresh coverage confirmation.

## Final UI pass complete — 18 October

All current application routes now have the Sketchbook presentation, including shared loading, retry, missing-page and leave-dialog states. `ui/feedback.css` extends the canonical tokens for neutral notebook panels and safe scrolling dialogs. `ui/kit.tsx` adds an accessible LoadingNotice and embedded/busy StateScreen variants; route loading views use them. Learning loading/error modules use the same outline treatment. Lab Escape now means Keep editing; short-viewport save bars leave room for reading. No service/persistence/auth/grading/backend/cloud change. The prior local integration remains preserved; PR work is deferred at the user's request.

154 frontend tests, lint and Node24 TypeScript/production build pass. Native sample checks cover320/390 recovery,320 leave dialog/Escape/keyboard save-and-leave, missing-attempt recovery, keyboard continuation and Home/lesson reflow at200% browser zoom. Existing per-page eight-width evidence below was not all repeated. Full automated browser suite, physical devices and full zoom matrix remain unverified. See [active status](active.md) for exact checks/proof and non-design dependencies.

Review **http://localhost:5195/** or existing connected **http://127.0.0.1:5194/**. The complete local UI pass is ready; source publication and PR decisions remain separate. No commit/push or remote changes.

## Integrated PR additions — 18 October

The three visual passes below are preserved in the local combination with reviewed PR #2 `df2de21` and PR #3 `4290e0f`/`1ad4d58`. Earlier guidance to port onto the separate PR #2 build is now fulfilled for these revisions. C-AM-08 versioned narration/phase recovery use Sketchbook styling; no-bucket text fallback and static Library remain. 154 frontend/103 Python tests and all code/contract checks pass. Native Chrome sample playback/phase/step recovery and C-AM-04 checks pass. Sample5195 and connected5194/API8001 are running; authenticated live data, responsive matrix/full browser suite were not rerun. No cloud media publication, commit/push or PR mutation. [Integration evidence](../../docs/plans/sketchbook-pr-integration.md).

Local branch `redesign/sketchbook-refinement` starts from published `feature/library-text-content` checkpoint `f3bae05`. It includes the complete first Sketchbook pass and static Library history. No commit/push/deployment for this iteration. Checkout remains `kiki-web-library-text`; existing dev servers read this branch.

## Review

- Connected Home: **http://127.0.0.1:5194/home**.
- Connected chapter: **http://127.0.0.1:5194/chapters/LP-ANALOG-MODULATION**.
- Connected lesson: **http://127.0.0.1:5194/concepts/C-AM-04**. Ordinary student actions retain their normal saves.
- Browser-only sample: the same routes on **5193**, explicitly labelled. Used for language/place/audio/diagram checks so live reading positions and preferences are not changed by QA.

## What changed

Home has a smaller greeting, a clearer continuation cover with a current-page marker and direct View chapter link, and separate main/secondary columns. Checks and tools lead; four-area evidence, saved lab preparation and recent upload filenames are secondary. Primary learning continuation stays dark; check/lab actions are quieter outlined controls. Recommendations, ownership, unanswered attempts, unassessed dimensions and persisted lab resumption use existing services.

The chapter opens with actual passed-check count/progress and the next lesson. Four-area evidence remains available under **View all four learning areas**; missing evidence remains Not assessed. Numbered English/Odia entries use two columns when the content region has enough room and one column on phones. Prerequisite counts replace long repeated lists visually; full names remain in the accessible link description, and every concept stays open. Lab requirements and the all-ten chapter-test gate are unchanged.

The lesson has a compact visible language dial, shorter header, expandable prerequisite reference, place-save feedback beside the reader, clearer English/Odia leading and balanced Back/Next actions. Its dial retains the original pointer/keyboard logic and full track target. Term sheets, narration, calculated plots and queued place saving retain their original behavior. No extraction/storage details were reintroduced into Library or the chapter.

## Files and consuming-build guidance

- `features/home/Home.tsx`, `LearningContinuation.*`, scoped `.home-refined` styles in `ui/sketchbook.css`: view grouping, direct chapter navigation and layout. `ResumeLab.tsx` changes only the action's visual variant.
- `features/learning/ChapterMapScreen.*`: header, count/progress, evidence disclosure, DOM reading order and responsive concept index. Uses the same `passed`, `nextConceptId`, `progress.rings` and readiness values.
- `ui/learning/MapNode.*`: optional `prerequisiteCount` presentation, full `prerequisiteNote` in the link's accessible description. Existing status/ring/badge semantics remain.
- `features/learning/LessonScreen.*`: wrappers/reference disclosure and layout only; preserve the other build's `placeSaver`, term selection, narration and preference logic when integrating.
- `ui/learning/LanguageDial.*`: optional `compact` prop (default false); CSS removes the duplicate frame and tightens caption spacing. Track/knob behavior and suggested-notch support are unchanged.
- Existing browser test sources are updated for progressbar semantics, evidence disclosure and prerequisite expansion. No new dependencies or canonical theme-token changes.

No API, DTO, authored lesson, catalog/version, grading, authentication, cloud configuration or Library persistence changes. The separate PR #2 build stays separate. Port these view wrappers/styles onto its newer behavior when integrating; do not overwrite its implementation with an older screen.

## Verification

138 frontend unit/contract tests, ESLint and TypeScript/production build pass. Existing Home tests still cover saved-concept recommendations, no fabricated passes and foreign-progress rejection. Production output excludes the checked fixture/answer-key markers; whitespace checks pass.

Browser sample checks: five dial notches, expanding prerequisite links, step navigation and step-2 restoration after reload, glossary opening/closing and focus return, four-area evidence, all ten concept links, locked chapter gate with zero passed checks, C-AM-08 sample narration play/speed/pause and cleanup on step change. DSB-SC exploration gives 1800/2200 Hz at 200 Hz message; reset gives 1900/2100 Hz. No assessment answers, results, seed passes or live preferences were changed.

Home, chapter (including expanded evidence) and lesson (including diagrams) have no horizontal overflow at 320/360/390/430/768/1024/1280/1440px. Odia phone reading was reviewed at 390px. Connected Home/Chapter were reviewed read-only and still show the existing 1/10 checks. Physical devices, browser text zoom and the full automated browser suite were not tested in this iteration.

Ignored proof: `test-results/sketchbook-refinement/home-desktop.png`, `home-phone.png`, `chapter-desktop.png`, `lesson-phone.png`.

The user accepted this first pass. The second pass below is now ready for review. Both passes remain local and uncommitted; existing published feature branches and PR #2 are untouched.


## Second pass: Checks, quiz, results and lab preparation

Review **http://127.0.0.1:5194/practice** and **http://127.0.0.1:5194/labs**. Start/resume a check from its concept card; saved results remain accessible through Last result. Lab mode offers the existing saved preparation. Browser-only QA uses the same routes on 5193.

Checks has compact progress summaries with accessible progressbars, a numbered concept list and a secondary chapter-test/history column. Quiz progress and question navigation share a reference panel; the question gets the main column. On phones the progress panel is compact. Selected answers have clear native radio state, and English/Odia text has comfortable leading. Results put revision actions and the concept breakdown alongside per-question feedback, with text/icons and distinct borders for passed/revisit states.

A keyboard issue found during browser review is repaired: disabling the fieldset for autosave drops native focus. The selected radio now regains focus after saving only if focus has fallen to the document body and the question is unchanged. Focusing language or another control is respected. Successful question navigation focuses and scrolls to the new question heading. Two new interaction tests cover both behaviors; browser test sources add focus assertions.

Lab mode has a start/resume cover beside required theory. The preparation has checkpoints and notes first in DOM/visual order, software and session tools alongside, and an expandable theory-readiness reference. A sticky **Save preparation** bar keeps real save status visible while writing. **Save notes** at the bottom submits the same existing save method. Checkpoint selection remains reading position only; manual/unassessed monitoring boundaries, all 12 checkpoints, revision/conflict handling, cross-device continuation and Save and leave are retained.

Files: `features/assessment/Checks.tsx`, `RunCheck.tsx`, `ResultView.tsx`, scoped `assessment.css`, `RunCheck.test.tsx`; `features/labs/LabPreparation.tsx` and its module stylesheet. Preserve current save/submit/ownership logic when porting these compositions onto the separate PR #2 build. No dependency, API, DTO, catalog, authored lab content, grade threshold or Library persistence change.

Verification: **140 frontend tests**, ESLint and TypeScript/production build pass. Browser sample: answer save/focus, language changes, incomplete-submit guard, indexed navigation/focus, pause/save/resume, actual sample submission (2/5 revisit result), result focus/reload and revision-confirmation retry link. Sample preparation: checkpoint 3 and clearly labelled QA prediction save/reload, dirty copy-link disabling, checkpoint 12 Next disabled, Save and leave/resume, theory disclosure and session/software controls. No experiment observations or proficiency were invented. One failed sample result and an unanswered second concept draft remain in the labelled browser preview; these are not live learner records.

Checks, quiz, result, lab landing and preparation have no horizontal overflow at 320/360/390/430/768/1024/1280/1440px. Phone Odia/notes and sticky save placement were inspected. Connected Checks, existing saved result and lab landing reviewed read-only: actual 1/10 concept checks, 1/7 lab prerequisites and prior 4/5 result retained. No live attempt/preparation/preferences were created or modified. Full automated browser suite, physical devices and text zoom were not run. Backend is unchanged; no new backend-test claim.

Ignored proof under `test-results/sketchbook-refinement/`: `checks-desktop.png`, `quiz-phone.png`, `result-desktop.png`, `lab-desktop.png`, `lab-phone.png`.

The user accepted the second pass. The third pass below completes the remaining page refinement; publication remains separate.


## Third pass: account, subjects and material — 18 October

The remaining component pass is ready. **http://localhost:5195/** is a fresh, explicitly labelled browser-only welcome/setup preview, using the same running source as the connected app. QA was performed on the separate origin **127.0.0.1:5195** so the new review origin stays untouched. Existing 5193 sample/5194 connected apps and their data are retained. Connected review links: `/subjects`, `/profile`, `/library` and `/subjects/CRS-AC-ECE/material` on 5194.

Welcome uses a responsive, numbered notebook with concept waveform, vocabulary example and practical section instead of floating cards. The decorative waveform is contained on the existing dark Signal Studio surface. Sign-in keeps its shared/personal-device radio choices, Google-only transport and clear sample entry; the main Google action is dark. Onboarding has a tighter progress/form composition, bilingual leading, stronger selected states and grouped controls. After a confirmed step change or Back, focus moves to the current heading; a failed save keeps the current form editable. Initial load does not steal focus.

Subject enrollment has a clearer semester form and study-route reference. The enrolled cover shows its actual enrollment state, and the subject overview groups chapter/check actions beside material actions. Profile puts language/support before the separate self-confidence group, with account/sign-out details alongside. Confidence still awards no proficiency.

Upload now starts with document selection and filename feedback, followed by material kind/topic and optional date/note groups. Keyboard focus on the native file input outlines the visible chooser. All original IDs, validation, disabled states, cancellation, payloads, extraction privacy and save navigation remain. Library uses compact neutral paper cards and a history/refresh toolbar. Vocabulary red stays specific to words; general actions stay dark. Cards remain static articles with filename/type/topic/date/Uploaded status and no text viewer, links, buttons or tab stops.

### Files and integration

- New scoped `src/ui/account-material.css`, imported after the canonical theme in `main.tsx`; shared theme tokens/kit are unchanged.
- `features/auth/Welcome.tsx`, `SignIn.tsx`, `onboarding/Onboarding.tsx`, `profile/Profile.tsx`: composition classes/notebook, native form grouping and step focus.
- `features/home/Home.tsx`: only its Subjects/SubjectOverview exports changed in this pass; preserve the accepted Home and real enrollment logic.
- `features/intake/AddMaterial.tsx`, `library/Library.tsx`: DOM reading order, fieldsets, toolbar, heading levels and static-card presentation. No extraction/persistence changes.
- `onboarding/Onboarding.test.tsx` covers failure/confirmed-transition focus; journey browser source adds a focus assertion. The full browser suite was not executed.

Port these view changes onto the separate in-progress PR #2 behavior when it is ready. Preserve its service composition, queued lesson saves and media/monitoring boundaries. No API/DTO/catalog/grading/auth mechanism, dependency, Firebase configuration, billing, Storage or deployment change.

### Evidence and limits

**141 frontend tests** pass with `npm test -- --pool=threads --maxWorkers=1`. Initial fork-based runs encountered test/worker startup timeouts; the controlled single-thread run passed without raising assertion timeouts. ESLint, TypeScript/production build, whitespace and production fixture/answer-key marker checks pass. No new backend test run is claimed because backend code is unchanged.

Fresh sample journey: keyboard ratings 9/10 and 3/10, mixed-language choice/manual support 4/5, four-step confirmation restored after reload; semester-5 enrollment; Profile English/support 3/5/confidence change saved and restored after reload/sign-out/sign-in; return to protected Profile retained; Library empty state; native chooser keyboard focus visible and upload disabled without files. Learning resumes at step 2 after reload; an unanswered check draft resumes at question 2; lab checkpoint 2 saves/reloads and Home resumes the same preparation. This origin has no submitted grade, uploaded material or invented experiment observation.

Eight-width overflow checks (320,360,390,430,768,1024,1280,1440px) pass for Welcome, sign-in, four onboarding steps, subject enrollment/enrolled state/overview, Profile, Library empty state and the fully loaded upload form. An early measurement of the upload loading placeholder was discarded. Connected Google sign-in returned to the existing Library: three real/prior cards and no interactive card descendants at 896px, no overflow. Existing live material/preferences/enrollment/assessments/lab fields were not edited. Populated connected Library was not resized across all eight widths in this pass; earlier Library acceptance is separate evidence.

File chooser automation previously needed the browser extension's file-URL permission; it was not retried or bypassed here. Actual extraction, internal content transport, mixed-failure/empty-upload guards and static-card behavior remain covered by passing tests; the user's earlier real PDF acceptance remains valid. Physical devices, browser text zoom and the full automated browser suite remain untested in this iteration.

Ignored proof: `test-results/sketchbook-refinement/welcome-desktop.png`, `welcome-phone.png`, `sign-in-desktop.png`, `setup-desktop.png`, `setup-phone.png`, `enrollment-desktop.png`, `subject-desktop.png`, `profile-desktop.png`, `profile-phone.png`, `upload-desktop.png`, `library-desktop.png`, `account-material-widths.json`.

Next: user review of the full refined application, followed by an explicitly authorized commit/push. All three passes remain local and uncommitted on `redesign/sketchbook-refinement` in `kiki-web-library-text`; the published feature branches and separate in-progress PR stay unchanged.
