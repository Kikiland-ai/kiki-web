# Sketchbook refinement — Home, chapter, lesson

17 October 2026 · first component pass ready · local branch `redesign/sketchbook-refinement`, based on published `f3bae05` (includes static Library history). Existing servers 5193 sample / 5194 connected use this checkout. No new commit/push/deployment instruction for this iteration.

Observed priorities: Home puts recent uploads ahead of checks and preparation; chapter cards repeat long prerequisite lists; lesson prerequisites and language controls leave too much space before reading.

Slices:
1. Home: compact greeting, clear continuation cover, check/tools in the main column and evidence/preparation/upload history in a secondary column. Keep real next-concept recommendation, pending attempts, lab resumption and static upload records.
2. Chapter: concise check progress and Continue action, expandable four-area evidence, responsive concept index with concise prerequisite counts and full accessible descriptions; preserve all concepts, authored bilingual titles, check results, draft label and lab/chapter gates.
3. Lesson: tighter header with a visible compact language dial, expandable prerequisite reference, stable place feedback near the reader, readable English/Odia type, comfortable step/action targets. Preserve placeSaver, audio, terms, diagrams and preferences.
4. Verify frontend checks/build and manual sample desktop/phone layouts, saved step navigation, glossary/dial/diagrams/audio. Connected Home/chapter read-only review; no new assessment, grade or cloud preference changes. Update status/walkthrough with actual evidence.

No API, DTO, authored content, catalog, auth, source-storage or grading changes. The separate PR #2 build stays separate. Public Library remains non-interactive upload history.

Completed: all three view slices, 138 frontend checks, lint/build and manual behavior/layout review. All five language levels, step-2 reload, glossary focus, narration pause/speed/cleanup, chapter evidence/gates and diagram exploration/reset pass. Eight-width overflow checks pass for Home/chapter/lesson. Connected Home/chapter read-only checks preserve existing progress. No full automated browser suite, physical-device or text-zoom claim. [Detailed handoff](../../apps/web/SKETCHBOOK_REFINEMENT.md). Exact next: user review, then component choices or separately authorized publication.

## Second component pass — Checks and lab preparation

User accepted the Home/chapter/lesson pass and asked to continue on 17 October. Keep the same local branch and existing uncommitted work. No publication instruction for either refinement pass.

- Checks: tighter actual-progress summary, clear concept list and secondary chapter/history column. No eligibility or result changes.
- Quiz/results: visible answer/save progress, question navigation and readable bilingual answer cards; bring revision/result actions alongside feedback. Preserve autosave, retry/leave guards, submission keys, thresholds and attempt history.
- Lab preparation: clear start/resume cover; primary checkpoint/notes column, quieter readiness references and software/session tools, visible save feedback/actions. Preserve manual/unassessed monitoring labels, owner/revision conflict guards and Save and leave.
- Verify using browser-only sample attempts/preparation. Connected checks/lab overview may be read, without starting/submitting a real attempt or changing real preparation fields. Existing API/catalog/preferences stay unchanged.

Second pass completed: Checks, quiz/result and lab compositions; native save-focus restoration and question-heading focus. 140 frontend tests, lint/build and manual sample behavior/8-width checks pass. Connected review is read-only; no new live assessment or lab write. See the detailed handoff for test scope and remaining account/subject/upload/Profile component work. Neither refinement pass is committed or pushed.

## Third component pass — account, subjects and material

User accepted the second pass and authorized continuing. Work remains on the same local branch with the previous changes retained.

- Welcome/sign-in: responsive notebook composition and compact account entry, preserving Google/session choices and labelled sample entry.
- Onboarding/Profile: clearer preference groups, compact setup progress and readable bilingual controls; preserve update payloads and resumable steps.
- Subjects: clearer empty/enrolled states, enrollment form and chapter/material actions using existing route logic.
- Upload/Library: document selection first, grouped metadata/optional details and compact static history cards. Extraction remains internal.
- Verify frontend checks, eight-width layouts and a fresh browser-only journey on a separate sample origin. Connected review read-only. No commit/push/deployment.

Third pass completed 18 October: account, subject, upload/Library/Profile refinements and fresh sample journey verification. 141 tests pass with one thread, lint/build and recorded layout checks pass; connected Library re-sign-in/read confirmed three static cards. Fresh review origin is http://localhost:5195/; QA origin 127.0.0.1:5195 retains its completed setup/draft/preparation. Full browser suite, new file-picker upload and physical devices/text zoom were not run. See the detailed handoff for exact evidence. Next is user design review and separately authorized publication.

## Final application pass — 18 October

User prioritized completing the redesign before returning to PRs. Keep the existing integrated source and all accepted page passes; no additional PR/GitHub work. Finish shared loading/recovery/not-found/leave-dialog presentation, confirm phone layout and enlarged browser reading, and check existing local journeys. No new live learner writes, backend/schema/storage/billing changes, commit or push. Record actual verification and remaining non-design dependencies in the current frontend status and walkthrough.

Final pass completed: neutral notebook recovery/connection/not-found views, shared accessible loading presentation, phone-safe scrolling/stacked dialogs, lab Escape preserving draft and short-viewport save bar. 154 frontend tests, lint/build and production exclusions pass on Node24. Native Chrome Guest checks cover320/390 recovery,320 lab leave/Escape/keyboard save-and-leave, missing-attempt retry presentation, Home keyboard continuation and 200% Home/bilingual lesson reflow. No full automated browser suite/complete zoom matrix/physical-device claim. No backend/cloud/live learner/GitHub changes. All current routes are visually implemented; exact next is user review, then return to PR decisions separately. See web active.md for current links/proofs.
