# Kiki web — active frontend status

Updated: 18 October 2026
Current step: Engineering Sketchbook publication checkpoint — checks passed

This is the **current frontend status record**. Update it after each completed step. [Build history](../../docs/plans/ui-build-progress.md) preserves earlier work; [student walkthrough](../../docs/ux/ui-slice-review.md) explains navigation.

## Source publication checkpoint — 18 October 2026

The user authorized committing/pushing `redesign/sketchbook-refinement` and opening a new PR into `main`. Existing PRs #1–#3 stay open until the replacement is merged and coverage is rechecked against their then-current heads. No automatic merge, branch deletion or deployment is part of this publication. Authenticated GitHub account/push permission and configured author/committer are verified as `akshitanitr`.

Fresh checks: **154 frontend /104 Python /28 data-model tests**, ESLint, TypeScript/production build, Ruff/format, source-case validation, Python→React response contracts and OpenAPI consistency pass. Prepared media packaging validates8clips in dry run only. Full candidate source scan finds no credential signatures, local env, dependency/build/test artifacts or files over10MiB. Production excludes fixture/private grading markers and WAV files. Recorded native phone/keyboard/200% zoom QA is retained; full automated browser suite and physical devices were not rerun for this checkpoint. No fresh authenticated learner writes, storage activation, billing/IAM or cloud media publication.

Thorough review found an optional-media edge case: method lookup happened before enrollment/context validation when the media adapter was absent. Requests now validate context first, preserving503 for an enrolled user and403 for an unenrolled one while keeping the complete text lesson. The added API regression covers both manifest and asset requests. No DTO/schema change.

Coverage was checked against PR #1 `39bdef9`, #2 `df2de21` and #3 `1ad4d58`: #1 is an ancestor; #2 has48 identical paths,12 intentional adaptations (combined Library schema/contracts, Sketchbook UI, handoffs and the guard regression) and12 removals matching upstream; no missing additions. All7 #3 paths match exactly. Existing Akshita/Arpan ownership is preserved. Recheck heads before closing superseded PRs after merge. [Integration evidence and closure gate](../../docs/plans/sketchbook-pr-integration.md).

Last completed: publication review and fresh validation. Exact next: commit/push the approved branch, open the replacement PR, verify the remote head/base/mergeability, and retain #1–#3 until merge.

## Redesign completed locally — 18 October 2026

User prioritized finishing the Engineering Sketchbook redesign before returning to the PRs. All three accepted page passes are retained. The final pass completes shared UI states: notebook recovery/connection/not-found panels, neutral outlined loading notices across routes, consistent retry alerts, scrolling phone leave dialogs and short-viewport lab saving. Embedded missing-subject/chapter/concept screens now sit inside the existing main landmark instead of introducing another full-height page. Missing concepts return directly to the chapter. Escape in the unsaved lab dialog keeps the current draft; both quiz/lab dialogs describe their consequences to assistive technology. No services, learner payloads, authentication, grading, authored lesson content, catalog, backend or cloud settings changed in this pass.

Coverage is complete for the current routes: welcome/sign-in/setup, Home/subjects, chapter/lessons/glossary/diagrams/narration, Checks/quiz/results, lab landing/preparation, upload/static Library, Profile and shared loading/recovery/leave states. This closes the local visual implementation pass; remaining media publication, content review and future monitoring work are separate feature dependencies. No further PR work or GitHub changes were made.

Final verification: **154 frontend tests / 32 files**, ESLint and TypeScript/production build pass on the required Node24. Initial shell invocation used the machine's default Node20 and could not start Vite/Vitest; reruns used Node24, without dependency or timeout changes. Production excludes checked fixture-store/private-answer markers and WAVs. Native Chrome Guest review: unknown subject/concept/chapter and global404 recovery, recovery cards at320/390px, scrolling/stacked lab dialog at320px, Escape retaining unsaved checkpoint change, keyboard Save and leave returning Home, read-only missing-attempt recovery, keyboard Home continuation focus, and Home plus bilingual lesson reflow at confirmed200% browser zoom. Browser zoom was restored to100% and DevTools closed. No real account/data writes, graded submission or experiment observations were made. Earlier eight-width page reviews remain prior evidence; the full automated browser suite, complete zoom matrix and physical-device checks were not run here.

Current local review: **http://localhost:5195/** for a fresh sample origin; **http://127.0.0.1:5195/** was used for temporary Chrome Guest QA, including a saved lesson place and checkpoint2 preparation; Guest data is temporary. Connected app **http://127.0.0.1:5194/** continues using existing config/API8001. Source stays local/uncommitted on `redesign/sketchbook-refinement`. Last completed: final shared-state/design verification and handoff. Exact next: user review of the complete local application; return to PR/source-publication decisions after design acceptance. No commit/push/merge/closure/deployment in this step.

Proof is ignored under `test-results/sketchbook-final/`: `subject-recovery-320.png`, `page-recovery-320.png`, `lab-leave-320.png`, `home-zoom-200.png`, `lesson-reading-zoom-200.png`.

## PR integration — 18 October 2026

The user approved integrating the reviewed additions into `redesign/sketchbook-refinement` after comparing PRs #1–#3. PR #1 `39bdef9` is already an ancestor; no unique code is needed. Applied PR #2 `ba40218` → `df2de21` concept-media delta and PR #3 commits `4290e0f`/`1ad4d58` (UTF-8 JSON and bounded pytest IDs) by three-way merging against the actual local refinement source. All 40 pre-existing modified/untracked paths were preserved. No GitHub PR merge/closure, commit, push or deployment was performed. [Integration plan and evidence](../../docs/plans/sketchbook-pr-integration.md).

C-AM-08 now consumes source-bound versioned media through authenticated API adapters; sample mode uses the same validated package. Revocable blob narration, the phase-recovery scene and no-bucket text fallback are retained. The new scene uses Sketchbook borders/controls and the existing dark Signal Studio waveform surface. Static Library cards, Firestore text persistence, queued lesson-place saves, all three refinement passes and C-AM-04 diagrams are preserved. OpenAPI was regenerated from both document-text and media routes.

Verification: **154 frontend tests / 32 files and 103 Python tests**, ESLint, Ruff/format, TypeScript/production build and Python→React response contracts pass. Media packaging dry run validates 8 clips/revision `cm-e0f086007cc9f2062af093f3`; no cloud writes. Production contains zero WAV files or private `correctIndex` fields; no dependency/lock/env change. Native Chrome Guest sample review confirms C-AM-08 phase presets 0/60/90°, keyboard 180°, reset, Odia playback progress/pause/1.25×, notch-3 English switching and player cleanup on step change, step-3 recovery after reload, C-AM-04 sidebands changing 1900/2100 → 1880/2120 Hz and the empty static Library route. Screenshot: ignored `test-results/pr-media-integration/phase-scene.png`.

Current previews restarted from this checkout: **http://127.0.0.1:5195/** sample; **http://127.0.0.1:5194/** connected → API8001. Connected uses the original approved env in process only. Frontend returns 200; unauthenticated media returns 401. No live account sign-in or learner write was repeated in this integration pass. No media bucket is configured/provisioned/published, so connected lessons remain text-only. Existing live Library acceptance above is historical; backend/contract tests revalidate its text transport here. Full browser suite, responsive matrix, physical devices, media publication and native Odia/scientific review were not repeated or completed. Next: review the combined local UI, then publish source only when explicitly instructed; cloud media activation remains separate.

## Sketchbook refinement — three component passes ready

Local branch `redesign/sketchbook-refinement` starts from published Library checkpoint `f3bae05`; the connected app 5194 and sample 5193 use this checkout. No push/commit/deployment for this new iteration. [Plan](../../docs/plans/sketchbook-refinement.md).

Implemented: Home foregrounds continuation and checks, with tools/language preferences in the main column and evidence/preparation/static upload history alongside. Compact cover/greeting and a direct View chapter action. Chapter has check progress, concise next action, expandable four-area evidence and responsive numbered concepts with compact prerequisite counts/full accessible descriptions. Lesson has a compact visible language dial, expandable prerequisite reference, clearer reading-state placement and English/Odia spacing. Existing queued saves, audio, diagrams, glossary and authored data are retained.

Verification: **138 frontend tests**, ESLint and TypeScript/production build pass. Browser sample checks cover all five dial levels, prerequisite expansion, saved-step reload, glossary focus, narration play/speed/pause/cleanup, chapter evidence/gates and accurate diagram exploration/reset. No overflow at eight widths (320–1440px) for Home, chapter and lesson; 390px Odia reading inspected. Connected Home/chapter reviewed read-only with existing 1/10 checks preserved. Full automated browser suite, physical devices and text zoom were not run. No API/auth/grading/catalog/storage changes.

Second pass implemented after user acceptance: compact Checks progress/list with chapter/history aside; quiz answer progress/navigation, bilingual cards and keyboard focus repair; result feedback with revision/breakdown aside; lab landing and checkpoint/notes-first preparation with sticky save status, software/session tools and expandable theory readiness. Existing save/submit/ownership/revision guards retained.

Second-pass verification: **140 frontend tests**, ESLint and TypeScript/production build pass. Two interaction tests cover answer focus after autosave and respecting focus on another control. Browser sample quiz save/navigation/incomplete-submit/pause/resume, actual 2/5 sample result/reload/retry gate, lab checkpoint/note save/reload/Save and leave/resume and all 12 checkpoints verified. All five second-pass screens fit eight widths, 320–1440px. Connected Checks, existing 4/5 result and lab landing reviewed read-only; actual 1/10 and 1/7 progress retained. No new live attempt, preparation or preference write. Full automated browser suite/physical devices/text zoom not run.

Third pass completed on 18 October after user acceptance: notebook welcome composition, compact Google/session choices, grouped onboarding/Profile preferences, confirmed-step heading focus, subject enrollment/overview actions, document-first upload form and neutral static Library cards/history toolbar. Existing authentication, preference/enrollment payloads, material extraction/transport and old-reader redirects retained.

Third-pass verification: **141 frontend tests** pass using `npm test -- --pool=threads --maxWorkers=1`; ESLint and TypeScript/production build pass. Initial fork-based runs timed out; no assertion timeout was relaxed. New onboarding interaction regression covers failed-save retention and heading focus after confirmed save/Back. Browser-only fresh journey on 127.0.0.1:5195 covers keyboard confidence/support, four-step recovery after reload, enrollment, Profile save/reload/sign-out/return, Library empty state, upload keyboard focus, lesson step-2 recovery, quiz draft pause/resume at question 2 and lab checkpoint-2 save/reload/Home resume. No graded attempt was submitted and no experiment observations were entered in this fresh sample.

Welcome, sign-in, all four setup steps, enrollment/enrolled subject/overview, Profile, empty Library and loaded upload form fit 320/360/390/430/768/1024/1280/1440px. Populated connected Library reviewed at its actual 896px viewport after existing Google sign-in: three prior upload cards, zero interactive children and no overflow. No new live material, preference, enrollment, grade or lab-preparation edit. File-picker end-to-end upload was not repeated; existing extraction/save/static-card tests pass and prior user PDF acceptance remains authoritative. Full automated browser suite, physical devices and browser text zoom were not run.

Last completed: all three refinement passes and a fresh sample journey through account, subject, learning, check draft and lab preparation. Exact next: user review on connected 5194 (Subjects/Profile/Library) or fresh browser-only **http://localhost:5195/** for welcome/setup. The separate QA origin 127.0.0.1:5195 retains the completed test journey. All source remains local/uncommitted; commit/push/deployment require a separate instruction. [Changes, files, verification and integration handoff](SKETCHBOOK_REFINEMENT.md). Source stays local on `redesign/sketchbook-refinement`; published Library branch remains at `f3bae05`.

## Current product decision — static upload history

The user confirmed a real lecture PDF extracts/saves successfully and its text is visible in Firestore. They now want extraction kept as an internal implementation detail. Library shows one static, non-interactive card per source: filename, material type, topic, uploaded date and Uploaded status. No Open request, text reader or original-download links. The upload form keeps processing internal, shows selected filenames, and returns directly to Library after successful Upload material. Paste/review/extraction/storage copy is removed from the product UI; old text source/receipt links redirect to Library. Home uses generic upload wording. Existing Firestore text/chunk APIs, auth, ownership and saved records are unchanged.

Verification: **138 frontend tests**, ESLint and TypeScript/production build pass. Regression checks cover static cards, old-reader redirects, hidden content still reaching the existing save transport, mixed document failures and empty-upload prevention. Connected Library reads both existing records, including the user's actual lecture; cards contain zero interactive controls. Library and upload form have no horizontal overflow at eight widths, 320–1440px. The browser material suite was updated for the new flow but not executed. Final publication recheck: all 94 Python tests, Ruff/format, Python→React response contracts, OpenAPI consistency and production fixture/answer-key exclusion checks pass. No new live record, learner evidence, billing or security change in this UI step.

Proof: ignored `apps/web/test-results/document-text/library-upload-cards.png`. Local connected review remains **http://127.0.0.1:5194/library**; sample 5193. Last completed: user accepted the PDF upload/static Library flow; final source review and checks pass, including a fresh connected Library reload. User authorized commit and push on 17 October to `origin/feature/library-text-content`, authenticated/attributed as `akshitanitr`. This checkpoint is for source publication only; no deployment. Exact next product step: real PPTX smoke test and later integration with the separate in-progress build when ready. Full automated browser suite was not rerun.

The text-reader/review acceptance below is historical implementation evidence and is superseded by the current product decision.

## Text-only Library — 17 October

User clarified that PDF/PowerPoint content should be retained as text in Firestore; original media does not need to be stored. Work is isolated in `feature/library-text-content` / `kiki-web-library-text`, based on published redesign `2cfc241`. [Plan](../../docs/plans/library-text-content.md).

Implemented browser PDF/PPTX extraction/review and paste-text fallback, explicit authenticated JSON text intake and paginated reads, atomic UID-owned Firestore text chunks, honest Text saved/original not stored views, and browser-only sample persistence using the same text extraction. Existing original-file endpoints and saved records are preserved. No billing, Storage, IAM, auth bypass or source-catalog changes.

Verification: **134 frontend and 94 Python tests** pass, with ESLint, Ruff/format, TypeScript/production build and Python→React response checks. Actual PDF/PPTX parsers are tested. Browser sample review/save/read/reload and 198 KiB Unicode pagination pass; reader has no horizontal overflow at eight widths from 320–1440px. Live Google sign-in → authenticated text save → Firestore read → full refresh → Library return passed on 17 October with one explicitly labelled synthetic English/Odia text document. File-picker automation remains extension-permission-blocked; the updated material browser suite was not run. Earlier original-upload blockers below are historical for original files and do not prevent this text path.

Local links: **5193** labelled browser-only sample; **http://127.0.0.1:5194** connected build → new API **8001** using existing approved configuration in process environments. Original apps/servers are preserved. New API routes and unauthenticated 401 verified; real Google sign-in, text save and subsequent reads return successfully. No original/media upload or learning evidence was created. [Text content implementation, limits and integration handoff](LIBRARY_TEXT_CONTENT.md).

Last completed: live Google → API → Firestore text persistence, full-refresh recovery and Library reopening verified with the labelled “Kiki Library verification — 17 Oct 2026” test entry. Proof is ignored under `test-results/document-text/live-saved-text.png`. Exact next: ordinary PDF/PPTX file-picker extraction/fidelity acceptance when browser upload access is available; actual parsers already pass unit tests. Feature remains local/uncommitted; no push/deployment performed.

## Engineering Sketchbook branch — current work

Branch `redesign/engineering-sketchbook`, separate checkout `kiki-web-sketchbook`, based on PR #2 `ba40218`. PR #2’s in-progress next build stays separate. [Implementation plan](../../docs/plans/engineering-sketchbook.md).

Foundation and first page pass implemented: local Space Grotesk/Noto Sans Oriya, canonical shared theme with learning aliases, outlined controls and surfaces, desktop/phone shell, Profile in header, direct Subjects/Checks navigation, real next-concept Home continuation, chapter index, notebook lesson pages, dark calculated waveform/spectrum plots, glossary/dial/sheets/audio player, materials/checks/account styles and blue manual preparation. No API/content/grade/catalog/auth changes.

ESLint, TypeScript/production build and **122 frontend unit/contract tests** pass. Browser review covers account/setup/enrollment, Home/subjects, chapter/lesson resume, five language levels, glossary focus/phone sheet, accurate spectrum/reset, C-AM-08 narration/languages/speed/pause/cleanup, sample quiz results, Profile persistence and preparation Save and leave/resume. Eight-width overflow checks pass for welcome, Home, chapter, lesson, material form, Profile and lab preparation. All setup steps pass at 320px; quiz/result and glossary were reviewed at 390px. PR #2’s queued place saver and audio behavior are retained.

Populated upload/review/original screens are styled but browser upload checking remains blocked by the extension’s file-URL permission. Library empty state was inspected. Full automated browser suite and live connected acceptance were not rerun. Physical devices/text zoom and content/Odia/audio review remain separate. [Theme source, coverage and integration handoff](ENGINEERING_SKETCHBOOK.md).

Local preview: **http://127.0.0.1:5192** (labelled browser-only sample). Original connected app and standalone demos are separate and preserved. No env file was copied or deployment performed. On 17 October the user authorized committing and pushing this completed source checkpoint to `origin/redesign/engineering-sketchbook`; authenticated account and author/committer are `akshitanitr`.

**Last completed action:** complete the first visual pass, checks and local review artifacts; document the shared token source and small TS wrapper changes for the separate in-progress PR build. **Exact next action:** review http://127.0.0.1:5192, choose component refinements, and integrate against the other build when its code is ready. Source publication is authorized on the separate `redesign/engineering-sketchbook` branch. No deployment.

The 16 October connected evidence below is historical baseline acceptance, not verification of this redesign.

## Current review links

| Address | What it is |
|---|---|
| http://127.0.0.1:5174/learn | **Connected app**: Google → Python → Firestore profile, enrolled chapter, bilingual lessons, saved places, assessments and progress. Add Analog Communication first if your account has no subject. |
| http://127.0.0.1:5173/learn | **Combined sample preview**: browser-only sample profile/material/attempts, clearly labelled. It never seeds real accounts. |
| http://127.0.0.1:8000/docs | Actual Python OpenAPI for profiles, materials, learning, positions, assignments, drafts, results and progress. /health is liveness only. |
| http://127.0.0.1:5180/chapters/LP-ANALOG-MODULATION | Arpan's original standalone reference; six preloaded sample passes, placeholder auth/quiz/Library. Use 5174 for real persistence. |

React + TypeScript + Vite. Full laptop workflows adapt to phone widths; physical-device checks remain separate.

## Latest completed implementation

**17 October — preprocessed concept media, first package (Arpan).** C-AM-08's existing eight narration clips are now a versioned, source-bound media package. It is delivered through authenticated Python routes and the `lesson.mediaExperience` pointer, and the hard-coded clip lookup is gone. Listen plays the API-delivered English/Odia clip with the same controls. Steps 2–3 add C-AM-08's own phase-recovery scene through a trusted renderer registry, whose first entry is C-AM-04's unchanged DSB-SC diagrams.
- Catalog `am-51187527300cba2fa3cca868` and learner state are untouched: media revisions are separate records.
- Connected media needs an approved private bucket (`KIKI_MEDIA_BUCKET`, not set). Until then connected lessons are text-only.
- Sample mode serves the identical package.
- The production build no longer ships any WAV.

Details, checks and remaining steps: [CONCEPT_MEDIA.md](CONCEPT_MEDIA.md).

Checks:
- Python: 9 new media tests; the existing suite unchanged.
- Web unit: contract, adapter, cache, phase model and player tests.
- All ten Python→React receipt checks, including the media lesson and manifest.
- 89 browser tests in installed Chrome, 8 of them new.
- axe: 0 violations with the player over the scene at 390/1280px.
- Lint, typecheck and build.

Not checked: live connected publication (blocked on storage), actual phones, and native-Odia/pronunciation/audio-quality/scientific review.

Exact next action: once an approved private bucket exists, run `scripts/publish_concept_media.py` (dry run, then `--apply`). Then repeat the signed-in C-AM-08 check on 5174: Listen, seek, speed, scene explore/reset, leave/reopen with progress intact. Backend media then owns durable preprocessing for the other nine concepts.

**16 October — DSB-SC teaching diagrams are connected.** Open http://127.0.0.1:5174/concepts/C-AM-04 → Step 2 (Concept), then scroll to **From two signals to two sidebands**. Step 3 (Application) also includes the visuals. The message × carrier → signed Product diagram and ideal positive-frequency spectrum show baseline **100/2000 Hz → 1900/2100 Hz**, with no separate carrier stem. The local 10–200 Hz message control updates waveform, stem geometry, text readings and accessible descriptions; reset returns to 100 Hz.

**Sideband / carrier / DSB-SC** open the existing English/Odia glossary plus relevant diagram context. Closing restores focus and retains a labelled target highlight; Clear diagram highlight removes it. Meaning appears before diagram context on small screens. Existing lesson word/text chips also select the target. Local exploration is not saved evidence and never changes lab settings or mastery. No narration or audio playback was added.

Python projects optional `lesson.visual` from the already-imported authored source concept. **Catalog version stays am-51187527300cba2fa3cca868; no Firestore migration/reimport or head change.** The actual API response validates against React's runtime contract. [Visual contract and rollback](TEACHING_VISUALS.md).

Verification: **80 Python**, **100 frontend**, **full 67 browser** checks pass; Ruff, ESLint, TypeScript/production build, ten Python→React response-envelope checks, BB8 package/discovery and whitespace checks pass. The first full browser run caught a new test reading the sheet's animated position too early; the assertion now waits for the final in-bounds position, and the complete suite passes. Production output excludes fixture position/assessment/lab stores and answer-key fields.

Live: real signed-in Firestore lesson loads; selecting Step 2 saves its reading place. The local 200 Hz control shows **1800/2200 Hz**, reset restores baseline, and sideband opens the authored Odia meaning with matching highlights. Reviewed at normal laptop/browser size and **390×844** emulation; temporary viewport reset afterward. Reload restores Step 2. No answers, grades, enrollment or profile preferences were changed in this step; lab preparation is untouched. Physical devices and expert/Odia review remain pending. Proof: ignored `test-results/dsb-visuals/live-spectrum.png` and `live-phone-term.png`.

## Previous completed implementation — lab preparation

**16 October — Lab preparation is now connected.** Top-right Lab mode selects DSB-SC from the live catalog, shows seven-concept readiness, and starts/resumes one owner/version preparation. The responsive tracker contains 12 authored checkpoints, prediction/model-reference/observation drafts, explicit Save, save/leave protection, conflict comparison and an owner-protected Copy session link. Home offers Resume lab preparation. Checkpoint position is reading only; no completion or score is awarded.

User confirms **Aditya owns monitoring and assessing screen-shared browser software**, to integrate later. No screen sharing, workspace observation, verified checkpoint, lab completion, execution controller or active Hey Clickky is implemented here. Public preparation responses enforce pending_integration / pointerActive=false / not_assessed. The older execution/lease API stays provisional. See [LAB_PREPARATION_CONTRACT.md](LAB_PREPARATION_CONTRACT.md) for exact boundary and the Aditya handoff.

Verification: **78 Python**, **96 frontend**, **full 60 browser** checks pass; eight targeted lab checks pass again after the final localhost-link notice. Lint, TypeScript/build, practical/preparation Python→React response validation, BB8 package/discovery and whitespace checks pass. Connected production excludes the lab fixture store/content and grading keys. Unit doubles do not prove concurrent cloud contention.

Live: current Google account opens Lab mode with **1 of 7** required theory checks passed; observed Concept 1's actual saved result is **80%** and map **1/10**. Started a real preparation, saved **checkpoint 2 / revision 1**, and reload restored it from Firestore. Prediction/model/observations remain blank; no invented experiment report, grade or model action. Original quiz tab was left untouched. Saved-link reopen and Home resume use the same owner/session; physical phone/laptop acceptance remains pending. Local 127.0.0.1 links are explicitly labelled same-computer only; a shared hosted app address is needed for real cross-device access.


**The original Analog Modulation JSON is now in Firestore**, split into 68 immutable version documents plus the active head, rather than fetched as one enormous frontend file. Version **am-51187527300cba2fa3cca868** in builder-cup-a8479. Ten lessons / 40 placards / 30 terms / eleven private assessment sets / experiment and original authored sections are preserved. case.seeds is excluded entirely. Source JSON stays in Git as versioned authoring/backup. The importer validates locally, atomically activates, rejects unexpected catalog replacement and is unchanged on repetition.

- Python serves authenticated chapter and lesson DTOs from Firestore, with draft review labels. No fixture fallback or direct browser Firestore writes.
- UID/version-owned placard positions survive reload/sign-in. Same position is repeat-safe. Reading never awards mastery.
- Python assigns immutable public questions, snapshots private keys, preserves revisioned drafts, grades on the server and atomically finalizes results. Start/draft/submit idempotency, stale-write checks, ownership and retry lineage are enforced.
- Chapter map and assessment overview share the same transactional latest-result summaries. Latest completed current-version retry wins; unfinished retries preserve the last result. All attempts remain stored; overview returns recent 15 plus older active attempts (maximum 11).
- Private keys/source checks have no public endpoint. Explanations are returned after submission only. Real attempts are always student_attempt. Retries currently use the same draft authored questions; no variant generation is claimed.
- Original Google/profile/onboarding, Home, intake/Library and Arpan map/lesson UI are preserved. An enrollment denial explains how to add the subject. Curated content is explicitly distinguished from uploaded-file generation.
- Language dial movement fix remains verified: matching --learning-at / --learning-angle variables, actual geometry/needle tests for keyboard, mouse and phone-sized touch taps.

Storage/schema/import/rollback: [../api/LEARNING_STORAGE.md](../api/LEARNING_STORAGE.md). React/Python interfaces: [LEARNING_CONTRACT.md](LEARNING_CONTRACT.md), [ASSESSMENT_CONTRACT.md](ASSESSMENT_CONTRACT.md). Arpan provenance: [ARPAN_INTEGRATION.md](ARPAN_INTEGRATION.md), source 2256077; his reference checkout remains clean.

## Verification and live acceptance

- **65 Python checks** (40 existing profile/material + 25 learning); Ruff and exported OpenAPI. Tests cover ownership, answer-key exclusion, idempotency/revisions, invalid options, thresholds, lab/chapter prerequisites, latest retries, content-version separation and lossless source preservation excluding seeds. Doubles check reads-before-writes; real cloud contention is not yet exercised.
- **93 frontend unit/contract checks**, **full 52 browser checks**, lint and TypeScript/production build pass. Responsive browser checks span 320/360/390/430/768/1024/1280/1440px, including actual knob movement/touch emulation.
- All seven Python response envelopes pass React's current Zod schemas and result-assignment validation via scripts/check-python-learning.mjs (API pytest writes ignored test receipts).
- Live: catalog imported, repeat import unchanged; every one of 68 documents read back and compared with the seed-free payload. No existing learner record changed by import.
- Live Google account: user specified **Semester 3**; Analog Communication enrollment saved through the app. Real chapter opens with **0/10**, no synthetic grades. Concept 1 Step 2 saved, restored after reload, and restored after independent Google sign-in in a second tab. Profile dial remains 2.
- Live assessment list loads from Python; Concept 1 creates a real **unanswered** assignment. Its question cursor saves and restores after reload; it is paused at Question 1 with 0/5 answered. No answers or grades were fabricated for the student. This was the initial 15 October acceptance. On 16 October the student completed the check, and the live map was subsequently observed at 1/10 with the saved 80% result. Physical phone/laptop resume is not claimed from a same-computer second-tab check.

Previously verified: real Google token revocation checks, onboarding/new/returning profile, owner-scoped Firestore Library list. Current dependency lock is retained (last audit: zero advisories); no dependency changes in this step. Media/speech, instructor/Odia review, physical devices, text zoom and real Simulink observation remain pending.

## Status by workstream

| Workstream | Current status |
|---|---|
| Account/profile/subject | Live Google/Firestore; Semester 3 enrollment verified |
| Map/lessons/glossary/dial | Live catalog/resume; C-AM-04 calculated diagrams, local exploration and linked term context verified |
| Assessments/progress | Python/Firestore implemented, API/contract/browser tests pass; live unanswered assignment verified; user confirmed the live check works on 16 October |
| Intake/Library | Sample originals in IndexedDB; Python private-original adapters tested; real Library metadata reads Firestore; live originals still need usable private Storage |
| Lab preparation/saved continuation | Implemented; live session/checkpoint save/reload verified. Monitoring and assessment owned by Aditya, deferred |
| Media/English/hardware | Later integrations; no generated/reviewed media or evaluated English claim |

## Now / Next / Later

- **Now completed:** connected DSB-SC diagrams and glossary context. Use 5174 for saved-account learning; 5173 is labelled sample mode.
- **Next:** student reviews C-AM-04 Step 2 diagrams, frequency control and sideband glossary. Then prepare reviewed narration/source assets before implementing Listen or synchronised teaching. Reconcile Aditya’s actual monitoring/assessment protocol later; physical phone/laptop acceptance needs a shared reachable app address.
- **In parallel:** colleague checks existing Firebase Storage. User authorizes **no payment or billing upgrade**. builder-cup-a8479 default bucket is absent; an API key does not provision Storage. No local-disk alternative was activated.
- **Later:** content/Odia review, uploaded-source generation, media and Arpan lab/hardware integration, actual Simulink checkpoints and device/release checks.

## Constraints

Google only. English UI, Odia explanations, intact English terms. Green concepts / red words / yellow academic English / blue practical. Course CRS-AC-ECE, chapter LP-ANALOG-MODULATION, experiment PR-AM-DSB. Five MCQs/concept ≥3/5; chapter ten questions across all concepts ≥8/10. All ten concept checks gate chapter; only 01/02/03/04/06/07/08 gate DSB-SC execution. Reading/confidence/uploads do not award mastery. Students perform simulator actions themselves.

Private Standard Firestore (default), Mumbai asia-south1, existing deny-all client rules and dedicated keyless kiki-profile-api account. No new IAM, billing, Storage, paid backup, deployment, commit or push. Local env/ADC stay ignored. Existing unrelated data-model edits are preserved.

## Cold pickup

- **Last completed action:** implemented and verified source-backed DSB-SC diagrams, source projection, glossary highlights, numerical/layout regression checks and real connected lesson review. Existing catalog/progress version retained.
- **Exact next action:** review connected C-AM-04 Step 2 at 5174/concepts/C-AM-04; use Message frequency and sideband disclosure. Next implementation candidate is reviewed narration, once content/audio/provider is settled. Keep Aditya’s observation/assessment boundary deferred.
- **Open first:** this file, ../api/LEARNING_STORAGE.md, ../api/active.md, LEARNING_CONTRACT.md, ASSESSMENT_CONTRACT.md, ARPAN_HANDOFF.md.
- **Git:** user authorized publishing this completed checkpoint to kiki-web on integration/connected-kiki-2026-10-16. This branch contains the combined app under apps/web and apps/api; TEAM_HANDOFF.md at repository root explains setup and ownership. Author/committer: akshitanitr, explicitly confirmed by the user. Earlier uncommitted-status notes are historical. Future publication/deployment remains a separate instruction.

## Completed-step log

| Date | Step | Evidence |
|---|---|---|
| 16 October | DSB-SC diagrams and linked glossary | 80 Python / 100 frontend / full 67 browser; live frequency/term/reload review; catalog unchanged |
| 13 October | Initial account/subject UI | 21 unit / 14 browser |
| 14 October | Contracts, intake/Library, assessment UI | 44 unit / 36 browser; user confirmed sample originals save |
| 14 October | Firebase Google sign-in | Live popup/reload/sign-out; 51 unit / 37 browser |
| 15 October | Python/Firebase profiles | 17 Python + live onboarding/reload/returning account |
| 15 October | Private upload/Library code | 40 Python / 59 frontend / 37 browser; originals pending |
| 15 October | Arpan map/lesson integration | 93 frontend / full 50 browser; 2256077 source |
| 15 October | Dial visual movement repair | 15 learning browser checks incl. two new geometry/touch regressions |
| 15 October | Firestore learning/assessment connection | 65 Python / 93 frontend / 52 browser; seven response contract checks; live import/lesson resume/unanswered assignment |

Review proof: ignored `test-results/firestore-learning/lesson-resume.png` shows the real connected lesson at Step 2 with Place saved. Final running API restarted with the checked implementation; connected map and lesson reopened successfully afterward. Main connected tab is left on Concept 1/Step 2; the temporary second-sign-in verification tab was closed.

## Resume check — 16 October

User confirmed continuation of Firebase learning, separate from Gamma visual exploration. Existing Python API and connected React server respond successfully. No code changes or repeated test suite in this resume check; the 65 Python / 93 frontend / 52 browser evidence above is from the completed 15 October implementation. Next live acceptance remains the student’s own first concept submission and result/map verification.

Connected quiz reopened on 16 October: Concept 1 / Attempt 1 still loads from Python/Firestore at Question 1 with Draft saved · 0/5 answered. Browser is left ready for the student to answer and submit. New review proof: ignored test-results/firestore-learning/resume-quiz.png. No answers, score, enrollment or preferences changed in this resume check.

## User acceptance — 16 October

After opening the live concept-check link, the user reported “yes it's working.” Recorded as user-reported live quiz acceptance; no additional answers/scores were entered by the agent and no separate result/map observation was performed in this status update. Recommended next slice is lab preparation + owned saved sessions/continuation; actual Simulink observation and Hey Clickky activation remain dependent on a supported integration. Uploaded originals remain separately blocked on usable no-payment Storage.

| 16 October | Lab preparation + saved sessions | 78 Python / 96 frontend / 60 full browser + final 8 lab rechecks; live creation/checkpoint 2 reload; Aditya monitoring deferred |

Lab review proof: ignored `test-results/lab-preparation/live-preparation.png`. Connected tab is left on the real saved preparation at checkpoint 2/revision 1. Live Home → Resume was confirmed to return to the same session. Other quiz tabs and the student’s saved scores are preserved.

## Firestore visibility confirmation — 16 October

User confirmed they can see the saved lab-preparation records in Firestore. No data/code changes in this confirmation. Recommended next independent implementation: add source-backed diagrams to the theory lesson, beginning with C-AM-04 DSB-SC (message/carrier/product signal flow plus correctly labelled sidebands); maintain existing saved state and language support. This is a recommendation, not an implemented feature. Narration/synchronized teaching follows after reviewed audio/provider work; Aditya’s monitoring/assessment stays deferred and Storage remains a separate colleague dependency.

The earlier Firestore-visibility recommendation above was implemented in the DSB-SC teaching slice; the latest section and cold-pickup fields at the top supersede that historical pending wording.

## Shared-repository publication checkpoint — 16 October

User requested commit/push of the completed work to Kikiland-ai/kiki-web. Prepared a separate integration worktree/branch, retaining existing main and Arpan source ancestry. The original Design-Thinking working checkout and running app are left intact. One active frontend lives in apps/web; apps/api, required source/runtime/asset snapshots and current plans/contracts/status are included. Root TEAM_HANDOFF.md supplies team setup, verification commands and feature ownership. No local env, credentials, learner records, dependency directories, generated receipts/test outputs or ad hoc personal IAM setup script is included.

The user explicitly selected **akshitanitr** as author/committer, overriding the older Arpan identity note in the source repository. Authenticated GitHub profile and repository push permission were verified. The integration branch is a reviewable checkpoint; main is not force-pushed or rewritten. Current implementation/acceptance above remains authoritative; no deployment or Firebase write is performed by publishing source.

Fresh publication checkout verification: locked npm/uv install, 80 Python / 100 frontend / full 67 browser / 28 source-model checks, lint/format/typecheck/build, source-case validation, ten actual Python→React response-envelope checks and production fixture/key exclusion pass. Browser checks used this checkout's own server on port 5176. Dependency audit: zero advisories. Staged source contains no local environment, private key/token, dependency/cache/test artifact or oversized file.
