# Arpan learning integration

15 October 2026 · Combined preview implemented; see active.md for verification and remaining live endpoints.

Source: https://github.com/Kikiland-ai/kiki-web, ui/arpan-a11y @ 22560772ea92d19007204928c5404bdc3b60d4fd. Original checkout is the sibling kiki-web repository, left clean on review/arpan-ui.

Objective: combine chapter → lesson → existing quiz → result → same map in apps/web, retaining the current Google/profile/material/quiz app. This is the agreed labelled-preview integration first; real Python content/progress/position/assessment endpoints are separate gates. No billing, Storage, commit, push or deployment changes.

Ported: ChapterMapScreen, LessonScreen, PlacardText and language/term/next/media-query helpers; required kit under ui/learning. CSS custom properties are prefixed --learning- to avoid altering existing screens; portal sheets use the same tokens. The older package/lock, shell, global fixture learner/store and lab/pointer adapters are not imported. Namespaced kit can later be consolidated with Arpan without breaking existing kit.tsx callers.

Content: chapter + ten lessons only from Arpan's generated fixture projection, with original metadata/source hashes. No question keys or seeded check records in this teaching payload. Draft/Odia review labels remain. It is compiled out of connected production builds.

Now: one LearningApi in Services, fixture progress projected from the current AssessmentApi, UID-scoped positions, profile-owned dial and central authenticated routes. Next: verify integrated navigation, pass/revisit/threshold/readiness boundaries, reload/sign-out/save errors and phone layouts; update active.md. Later: Python contracts and real lesson/scoring persistence, reviewed media and actual lab guidance.

Success: a fresh sample learner has no invented passes; studying saves position but grants no mastery; quiz results and map agree; latest retry wins; chapter requires ten concept passes; DSB-SC needs seven; shared-account data is protected; connected mode never substitutes sample content/results.

## Actual adaptations and checks

Services.learning is now composed in create-services.ts and fixtures/services.ts. Runtime validation is in contracts/learning.ts; ownerLearnerId is required on ChapterProgress. Fixture progress uses services/learning-progress.ts and the existing assessment store, with no seeded passes. Positions are UID-scoped/validated; profile dial saves through Session.update with visible retryable errors. Routes are lazy under the existing Gate. Home/subject and quiz result connect to the map. Green nodes show pass coverage and label latest accuracy separately; missing prerequisites are explained.

93 unit/contract checks and full 50 browser checks pass; lint/typecheck/build pass; current dependency audit has zero advisories. Final compact missing-lab-list adjustment passed all 13 learning browser checks again, plus lint/build. Browser tests verify all eight widths, modal fit/focus, lesson resume/re-entry, shared quiz history, save errors/retry and prerequisites. Actual sample browser also shows 0/10 unassessed on the combined map; no previous sample work was cleared.

Connected mode uses only bearer HTTP adapters. Python learning/progress/position/assessment endpoints remain unimplemented; explicit unavailable errors are intentional. The current profile/Firestore and Library integration is preserved. No fixture content or answer keys enter connected production assets; UI sample labels may remain as ordinary strings.

Next: implement Python catalog/positions and authoritative assessment/progress, using LEARNING_CONTRACT.md and ASSESSMENT_CONTRACT.md. Real Simulink and file Storage remain independent. Neither source repo nor current app has been committed/pushed/deployed for this task.

## 15 October — connected follow-through

Python catalog/positions/assessment/progress now implemented and aligned; original ledger/Odia case imported into versioned Firestore with all seeds excluded. Live Google account opens the map and resumes a saved placard after reload/fresh sign-in; unanswered assessment assignment/cursor saves also verified. Student chooses their own answers for the first live submit/result acceptance. See active.md and ../api/LEARNING_STORAGE.md. Arpan UI ownership and clean reference checkout remain unchanged. No commit/push/deploy or paid Storage change.
