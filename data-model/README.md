# Data model v2: any subject, any scope, anything a student brings

The model no longer assumes Electronics, Odia, a circuit lab or a full chapter. A student can bring a syllabus, a chapter name, one question, a photo of a textbook page, a professor's notes, a past paper or an experiment sheet. Every input becomes a `StudyRequest`. It is matched against what already exists, and anything new is generated into the same validated lesson pyramid. The diode chapter is one of four worked examples.

| File | What it holds |
| --- | --- |
| `types/content.ts` | Course, subject profile, exam profile, past papers, the lesson pyramid, concepts and everything inside them, practicals, the ledger file |
| `types/intake.ts` | StudyRequest, SourceDoc, Resolution, OutlineProposal, GenerationJob, SmartLink |
| `types/learner.ts` | Learner, goals, route, concept state (four rings), attempts and diagnosis, practice sets, handwriting marking, repair plans, receipts, word stickers, practical runs, classes and class pulse |
| `subject-profiles.json` | The only place subject rules live: practical label and kinds, visual kinds, interactive kinds, check mix, whether units matter, fault-card wording |
| `ledgers/` | Four worked ledgers (below) |
| `types/learning-case.ts` | Additive case contract: bilingual placards, assessment selection/policies, Simulink configuration, tracking, evidence and handoff |
| `cases/analog-modulation-odia.json` | Full Odia–English Analog Modulation case and explicitly synthetic learner/session fixtures |
| `ANALOG-MODULATION.md` | Readable chapter outline, lab route, relationships, storage mapping and verification |
| `validate-case.js`, `runtime/learning-case.js` | Case checks and pure quiz/lab-entry/pointer/handoff domain rules |
| `validate.js` | Generic validator; run it on a file or a folder |
| `tools/migrate-v1-to-v2.js` | Converts a v1 ledger, with the content fixes the new validator found |
| `tools/test-validator.js` | Seeds 13 known errors and checks each is caught |
| `archive-v1/` | The original diode-only schema, ledger, validator and README, unchanged |

## What changed from v1

| v1 assumption | v2 |
| --- | --- |
| `branch: 'Electronics' \| 'Electrical' \| 'Chemical'` | `discipline` (free text) and `subjectProfileId`; add a subject by adding a profile |
| `studentLanguage: 'or'` | `languages: { source, support[], dial }`; any number of support languages, each with its own review status per concept |
| Every plan is a full chapter | `scope: 'chapter' \| 'topic' \| 'concept'`. A chapter has 2 to 5 broad concepts; a topic has 1 broad concept with 2 to 5 concepts; a single question becomes a concept-scope plan with 1 and 1. The UI is the same for all three |
| Syllabus lines are required | A plan with no syllabus names the `StudyRequest` that set its boundary (`requestId`) |
| Lab is always a circuit simulator | `Practical` with a kind (simulation, physical lab, software tool, drawing, coding, field, calculation task), steps, observations, expected result, fault cards and viva prompts. Subjects with no practical work (Mathematics) hide the practical ring (blue in the current journey) |
| `Diagram.kind` is electronics-only | `Visual.kind` is open, with per-subject suggestions (process flow, free body, structure, equation, annotated notes…) |
| DiodeExplorable is a one-off widget | `Interactive` with six generic kinds: parameter sweep (inputs, formulas, plot), step through, label parts, sort steps, compare toggle, simulation |
| `lab_predict` | `predict`; question types add multi-select, fill blank, order steps, label diagram, derivation, code |
| `examWeight` typed by hand | `examSignal` computed from `PastQuestion`s mapped to concepts; `basis` says whether it is real, estimated or absent |
| Terms owned per chapter only | Terms are unique across the whole course; concepts list borrowed terms in `usesTermIds` |
| Prerequisites only inside the chapter | Prerequisites can cross plans; `externalPrerequisites` model school topics (Class 12) as bridge nodes that can flicker |
| Source only at chapter level | `SourceRef` on every explanation, visual, example, worked question and check, so the UI can say "From your notes, page 3" |
| No review state | `review.status`: draft, auto_checked ("Kiki-made" label), teacher_checked, flagged |
| No learner, practice or repair data | `types/learner.ts` |

## The four worked ledgers

| Ledger | Subject | Scope | Came from | Shows |
| --- | --- | --- | --- | --- |
| `electronics/diodes-and-rectifiers.json` | Electronics | chapter: 4 broad concepts, 12 concepts | Curated, from the v1 ledger | Simulation practical with three fault cards, two parameter sweeps, a bridge to Class 12 semiconductor basics |
| `chemical/steady-state-material-balances.json` | Chemical Engineering | topic: 1 broad concept, 2 concepts | A professor's notes (SourceRefs to pages) | Physical lab, a sort-steps interactive, exam signal computed from two sample past papers |
| `mathematics/eigenvalues-from-a-question.json` | Engineering Mathematics | concept: 1 and 1 | One typed question in a self course | No practical (three-ring subject), no syllabus (bounded by the request), step-through interactive |
| `electronics/analog-modulation.json` | Analog Communication | chapter: 4 broad concepts, 10 concepts | User-selected curated chapter; no college syllabus claimed | DSB-SC simulation, 50 concept MCQs, 10 separate chapter MCQs, 27 optional checks; paired bilingual case with 40 placards and 12 checkpoints |

The original three ledgers retain their existing contracts. The Analog Modulation ledger passes `validate.js` and strict `Ledger` type checking, and its case passes the `LearningCase` contract and `validate-case.js`. Content remains **draft** pending instructor and native Odia review.

## Running it

```
node validate.js ledgers                     # every ledger, plus cross-ledger checks per course
node validate.js ledgers/chemical/steady-state-material-balances.json
node tools/test-validator.js                 # 13 seeded errors, all must be caught
node validate-case.js                        # ledger plus bilingual/case/session invariants
node --test tools/test-learning-case.js      # scoring, activation, handoff and numerical checks
node tools/migrate-v1-to-v2.js archive-v1/diodes-and-rectifiers.ledger.json ledgers/electronics/diodes-and-rectifiers.json
```

The current journey uses **green for concepts, red for technical words, yellow for academic English, and blue for practical application**. Dimension keys remain unchanged. MCQ correctness never supplies English or practical proficiency evidence. See [the Analog Modulation guide](ANALOG-MODULATION.md) for the 60% concept / 80% chapter policies and required-concept-only lab gate.

## Rules the validator enforces

| Rule | Checks |
| --- | --- |
| S1 to S3 | The subject profile is embedded and matches the course; the language policy and dial labels are complete; the course and plan point at each other |
| P0 to P4 | Pyramid shape for the plan's scope; exactly one parent per concept; every split states its dimension and rationale |
| ME1 to ME4 | Each objective has one owner; each term is introduced once; no duplicate objectives, titles, canonical keys, terms or ids |
| CE1 to CE3 | The objective tree mirrors the pyramid; every syllabus line is covered, or the plan names its request; out-of-scope topics are named |
| C0 to C7 | Canonical key; explanation with a visual, a 3 to 8 step walkthrough whose targets are in the text, and a valid interactive (formulas are evaluated at the defaults); example; worked question with a known type and a rubric that adds up; the profile's check mix; checks test only their own objectives; misconceptions; sources and review status |
| T1 to T3 | Minutes add up; practicals and concepts point at each other; practicals have steps, an expected result, fault cards and viva prompts; no practicals in subjects without them |
| D1 to D3 | Prerequisites exist and form no cycles; a concept never uses a term before the concept that introduces it is a prerequisite |
| X1, X2 | Every concept has an exam signal; when past papers exist, the signal matches them |
| L1 | Every concept has a localization entry for each support language |
| XL1 to XL4 | Across ledgers of one course: no term introduced twice, no dangling term uses or prerequisites, no duplicate concepts |

The new rules found four content issues in the diode ledger, now fixed in the migration:

- C-2.2 and C-2.3 used "peak inverse voltage" before C-2.4 introduced it. The term now belongs to C-2.2.
- C-1.2 explained "reverse saturation current", which C-1.3 owned. It now belongs to C-1.2.
- C-2.3's worked answer needed "centre-tap transformer" without linking it.
- A 2-mark written check (Q-2.4-d) had no rubric.

## How anything a student brings becomes lessons

1. **Request.** Every input becomes a `StudyRequest` with its `SourceDoc`s (pages, OCR text, detected languages).
2. **Match first.** Look for existing concepts by `canonicalKey` and embedding. "What is ripple?" opens the existing concept; it never creates a duplicate.
3. **Resolve.** Kiki picks one action: open existing, answer only (with "Make this a lesson"), attach material (SourceTags appear on existing concepts), extend a plan, or create a new plan at the right scope.
4. **Propose.** For a new or extended plan, show an `OutlineProposal` (broad concepts, concepts, out of scope, minutes, what it is based on). The student confirms or edits it.
5. **Generate.** A `GenerationJob` runs outline, validate, draft, validate, localize. Concepts are generated in route order, so the first lesson is playable within a minute while the rest finish.
6. **Label.** Content is `auto_checked` and shown with a "Kiki-made" label until a teacher checks it. A student's report flags it and hides it until it is fixed.
7. **Absorb.** When the syllabus arrives later, concept-scope plans are merged into the chapter plan (`mergedIntoId`). The learner's state carries over because it is keyed by concept id.

## Storing it (Firestore)

- **Content:** one collection per entity, keyed by id: `courses`, `subjectProfiles`, `examProfiles`, `pastPapers`, `pastQuestions`, `lessonPlans`, `broadConcepts`, `concepts` (explanation, example, worked question and checks inside), `objectives`, `terms`, `practicals`.
- **Generated text variants:** `variants/{entityId}:{field}:{lang}:{level}`.
- **Intake:** `requests`, `sourceDocs`, `jobs`, `smartLinks`.
- **Learner data:** under `learners/{id}/`: `conceptStates`, `attempts`, `routes`, `practiceSets`, `submissions`, `repairPlans`, `receipts`, `stickers`, `practicalRuns`.
- **Classes:** `classGroups`, and `classPulse` (aggregates only).

Past-paper weights in the diode ledger are still sample values. The chemical ledger's past papers are illustrative. All Odia text needs a native speaker's review.
