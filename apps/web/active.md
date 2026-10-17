# Kiki web — active frontend status

Updated: 16 October 2026
Current step: connected DSB-SC teaching diagrams + linked Odia term context completed; Aditya monitoring remains deferred

This is the **current frontend status record**. Update it after each completed step. [Build history](../../docs/plans/ui-build-progress.md) preserves earlier work; [student walkthrough](../../docs/ux/ui-slice-review.md) explains navigation.

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
