/**
 * Content model v2: subject-agnostic.
 *
 * Works for any course, chapter, topic or single concept a student brings to us:
 * an Electronics chapter from a syllabus, a Chemical Engineering topic from a professor's notes,
 * or one Mathematics question typed at 11 pm. Nothing here names a branch, a device or a language.
 *
 *   Course                      (a university course from a syllabus, or the student's own "self" course)
 *     └─ LessonPlan             (scope: chapter | topic | concept; one governing question)
 *          └─ BroadConcept      (chapter: 2 to 5; topic and concept scope: exactly 1)
 *               └─ Concept      (chapter and topic: 2 to 5 per broad concept; concept scope: exactly 1)
 *                    ├─ explanation  (text + visual always; voice walkthrough; optional video; optional interactive)
 *                    ├─ example
 *                    ├─ workedQuestion  (fully answered, with a concept rubric; English is judged separately)
 *                    ├─ checks[]        (mix comes from the SubjectProfile)
 *                    └─ practicalId?    (lab, simulation, software, drawing, coding or field task)
 *
 * MECE is enforced through ownership:
 *   - Every Objective is owned by exactly one node.
 *   - Every Term is introduced by exactly one Concept in a Course (other concepts list it in usesTermIds).
 *   - Every syllabus line (when the course has a syllabus) maps to at least one Concept.
 * validate.js checks all of this, with shape rules that depend on the plan's scope.
 *
 * The course source language (usually English) is the source of truth. Support-language text and the
 * dial levels are generated from it and reviewed before they ship (Localization).
 */

export type Id = string;
/** BCP-47-style code: 'en', 'or' (Odia), 'hi', 'bn', 'te', 'ta', 'mr'... */
export type LangCode = string;
/**
 * The four mastery dimensions, one per Google colour. Keys are fixed because the design system uses them.
 * 'lab' means "doing": a lab, simulation, software tool, drawing, code or field task.
 * Its student-facing label comes from SubjectProfile.practice.label ("Lab", "Practical", "Drawing", "Code").
 * When a subject has no practical work, the lab dimension is not applicable and the ring shows three segments.
 */
export type Dimension = 'concept' | 'words' | 'english' | 'lab';
export type Bloom = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create';
export type Scope = 'chapter' | 'topic' | 'concept';

/* ------------------------------------------------------------------ */
/* Subject profile: the only place subject-specific rules live          */
/* ------------------------------------------------------------------ */

export type PracticalKind = 'simulation' | 'physical_lab' | 'software_tool' | 'drawing' | 'coding' | 'field' | 'calculation_task';
export type VisualKind =
  | 'circuit' | 'block' | 'flowchart' | 'process_flow' | 'graph' | 'waveform' | 'physical' | 'structure'
  | 'free_body' | 'table' | 'equation' | 'timeline' | 'photo' | 'annotated_notes' | (string & {});
export type InteractiveKind = 'parameter_sweep' | 'step_through' | 'label_parts' | 'sort_steps' | 'compare_toggle' | 'simulation';
export type QuestionType =
  | 'mcq' | 'multi_select' | 'numerical' | 'term_match' | 'fill_blank' | 'order_steps' | 'label_diagram'
  | 'short_english' | 'spoken' | 'long_written' | 'diagram' | 'derivation' | 'predict' | 'code';
export type FaultType = 'Flipped' | 'Wrong value' | 'Missing piece' | 'Wrong connection' | 'Wrong tool setting' | 'Wrong measurement' | 'Wrong assumption';

/** A required slot in every concept's check mix: at least one check of these types in this dimension. */
export interface CheckMixRule {
  dimension: Dimension;
  anyOfTypes: QuestionType[];
  when?: 'always' | 'has_practical';
}

export interface SubjectProfile {
  id: Id;                       // 'electronics', 'chemical', 'mathematics', 'generic'
  label: string;
  practice: {
    applies: boolean;           // false: the lab dimension is hidden for this subject
    label: string;              // student-facing name of practical application (blue in the current journey)
    kinds: PracticalKind[];
  };
  visualKinds: VisualKind[];    // what diagrams in this subject usually are (a brief for the image model)
  interactiveKinds: InteractiveKind[];
  checkMix: CheckMixRule[];
  unitsMatter: boolean;         // numerical answers need a unit to count as correct
  /** Subject wording for the seven general fault types, shown on fault cards. */
  faultTypeLabels?: Partial<Record<FaultType, string>>;
}

/* ------------------------------------------------------------------ */
/* Course, language, exams                                              */
/* ------------------------------------------------------------------ */

export interface DialSpec {
  levels: number;               // 5 in the product
  /** One label per level, 1 = most support-language help, last = exam English. */
  labels: string[];
}

export interface LanguagePolicy {
  source: LangCode;             // the language content is authored and examined in
  support: LangCode[];          // languages the student can lean on; the first is the default
  dial: DialSpec;
}

export interface Course {
  id: Id;
  title: string;                // "Basic Electronics", "Material and Energy Balances", "My questions"
  kind: 'university' | 'self';  // self = built from what the student added, no syllabus
  institution?: { university?: string; college?: string };
  programme?: string;           // "B.Tech"
  discipline: string;           // free text: "Electronics and Communication", "Chemical Engineering"
  subjectProfileId: Id;
  term?: { semester?: number; year?: number };
  languages: LanguagePolicy;
  examProfileId?: Id;
  syllabusDocId?: Id;           // SourceDoc the syllabus came from
  lessonPlanIds: Id[];
}

export type ExamKind = 'mid_sem' | 'end_sem' | 'internal' | 'quiz' | 'viva' | 'lab_exam';

export interface ExamProfile {
  id: Id;
  body: string;                 // the university or board; "Sample" until the real one is known
  exams: {
    kind: ExamKind;
    date?: string;              // ISO date, set by the student or the class link
    durationMin?: number;
    totalMarks?: number;
    pattern: { type: QuestionType; marks: number; count: number; choice?: string }[];
  }[];
  englishRubricId: Id;          // how answers' English is judged and reported
}

export interface PastPaper {
  id: Id;
  examProfileId: Id;
  examKind: ExamKind;
  title: string;                // "Basic Electronics, Nov 2025"
  year: number;
  sourceDocId?: Id;
  questionIds: Id[];
}

export interface PastQuestion {
  id: Id;
  paperId: Id;
  text: string;
  type: QuestionType;
  marks: number;
  conceptIds: Id[];             // mapped by Gemini, confirmed by a person; drives exam weight
}

/**
 * How English is judged in written and spoken answers. Never deducts concept marks;
 * reported as a band per criterion so the student sees which marks were lost to language.
 */
export interface EnglishRubric {
  id: Id;
  criteria: {
    key: 'terms' | 'structure' | 'clarity' | 'completeness' | 'connectors' | (string & {});
    label: string;
    levels: [string, string, string];   // not yet, nearly, exam-ready
  }[];
  neverPenalise: string[];      // e.g. "spelling that does not change meaning"
}

/* ------------------------------------------------------------------ */
/* Provenance and review                                                */
/* ------------------------------------------------------------------ */

export type Origin =
  | 'student_notes' | 'student_question' | 'syllabus' | 'past_paper' | 'textbook' | 'experiment_sheet'
  | 'teacher' | 'curated' | 'generated';

/** Where one piece of content came from. The UI shows it as a SourceTag ("From your notes, page 3"). */
export interface SourceRef {
  origin: Origin;
  sourceDocId?: Id;
  locator?: string;             // "page 3", "Q2(b)", "slide 14"
  label?: string;
  url?: string;                // verified public reference; never substitutes for an uploaded SourceDoc
}

export interface Review {
  /**
   * draft: generated, not yet validated
   * auto_checked: passed validate.js and Gemini self-check; shown with a "Kiki-made" label
   * teacher_checked: a teacher or the team checked the worked answers and checks
   * flagged: a student or teacher reported a problem; hidden until fixed
   */
  status: 'draft' | 'auto_checked' | 'teacher_checked' | 'flagged';
  by?: string;
  at?: string;
  notes?: string;
}

/** Generated text variants per support language. Stored outside the ledger, keyed entityId:field:lang:level. */
export interface Localization {
  perLanguage: Record<LangCode, {
    status: 'to_generate' | 'generated' | 'reviewed';
    levels: number[];           // dial levels generated so far
    reviewer?: string;
  }>;
}

/* ------------------------------------------------------------------ */
/* The pyramid                                                          */
/* ------------------------------------------------------------------ */

/** One split in the pyramid, stated so a reviewer can check it. */
export interface MeceSplit {
  dimension: string;            // the single axis of the split
  rationale: string;            // why the parts don't overlap and nothing is missing
  outOfScope: string[];         // named exclusions, so "exhaustive" has a boundary
}

export interface SyllabusLine {
  id: Id;
  text: string;                 // as written in the syllabus
  conceptIds: Id[];
}

export interface LessonPlan {
  id: Id;
  courseId: Id;
  scope: Scope;
  title: string;
  governingQuestion: string;
  canDo: string;
  objectiveId: Id;              // apex objective
  mece: MeceSplit;
  broadConceptIds: Id[];
  syllabusLines: SyllabusLine[];// may be empty for self courses; then requestId sets the boundary
  requestId?: Id;               // the StudyRequest that created this plan (intake.ts)
  mergedIntoId?: Id;            // a concept-scope plan later absorbed into a chapter plan
  estMinutes: number;
  sources: SourceRef[];
  review: Review;
}

export interface BroadConcept {
  id: Id;
  lessonPlanId: Id;
  order: number;
  title: string;
  governingQuestion: string;
  objectiveId: Id;
  mece: MeceSplit;
  conceptIds: Id[];
}

export interface Objective {
  id: Id;
  statement: string;            // measurable: "Explain…", "Calculate…", "Draw…"
  bloom: Bloom;
  parentId: Id | null;
  ownerId: Id;
}

export interface Term {
  id: Id;
  term: string;                 // canonical term in the course source language, never translated
  aliases?: string[];           // "PIV" for "peak inverse voltage"
  symbol?: string;              // "r", "V_m", "λ"
  unit?: string;                // "V", "kg/h"
  definition: string;
  glosses?: Record<LangCode, string>;  // support-language explanation; needs native-speaker review
  pronunciations?: Record<LangCode, string>; // English term's pronunciation in the regional script, separate from meaning
  ownerConceptId: Id;           // introduced here; unique across the course
}

export interface Misconception {
  id: Id;
  statement: string;
  correction: string;
  faultType?: FaultType;        // when the misconception shows up as a practical fault
}

export interface ExternalPrerequisite {
  title: string;                // "Semiconductor basics (Class 12)"
  level: 'school' | 'earlier_course';
  canonicalKey: string;
}

export interface Concept {
  id: Id;
  broadConceptId: Id;
  order: number;
  title: string;
  canonicalKey: string;         // normalised slug used to match requests and avoid duplicates: "ripple-factor"
  canDo: string;
  objectiveIds: Id[];           // owned (exclusive)
  prerequisiteIds: Id[];        // concept ids, may be in other plans of the course; must form a DAG
  externalPrerequisites?: ExternalPrerequisite[];  // shown as "bridge" nodes that can flicker
  termIds: Id[];                // introduced here (exclusive)
  usesTermIds: Id[];            // used here, introduced elsewhere in the course
  misconceptions: Misconception[];
  explanation: Explanation;
  example: Example;
  workedQuestion: WorkedQuestion;
  checks: CheckQuestion[];
  practicalId?: Id;
  examSignal: ExamSignal;
  estMinutes: number;
  localization: Localization;
  sources: SourceRef[];
  review: Review;
}

/** How much the exam cares. Computed from PastQuestions when there are any; otherwise an estimate. */
export interface ExamSignal {
  basis: 'past_papers' | 'estimate' | 'none';
  askedIn: number;              // papers that asked it
  outOf: number;                // papers considered
  avgMarks?: number;
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Inside a concept                                                     */
/* ------------------------------------------------------------------ */

export interface Explanation {
  keyIdea: string;              // one sentence to remember
  text: string;                 // canonical explanation, 60 to 140 words
  modalities: {
    textImage: { visual: Visual };                      // always
    voice: { walkthrough: WalkStep[] };                 // KikiWalkthrough, 3 to 8 steps
    video?: { format: 'narrated_slides' | 'generated_clip'; durationSec: number; beats: string[] };
    interactive?: Interactive;                          // replaces the diode-only explorable
  };
  defaultModality: 'textImage' | 'voice' | 'video';
  from?: SourceRef;
}

export interface Visual {
  kind: VisualKind;
  description: string;          // what to draw: a brief for the illustrator or image model
  alt: string;
  assetId?: Id;                 // once drawn or cropped from the student's notes
  from?: SourceRef;
}

export interface WalkStep {
  target: string;               // a phrase in explanation.text that Kiki marks
  mark: 'sweep' | 'marker' | 'lens' | 'connect' | 'circle';
  dim: Dimension;               // colour of the mark
  say: string;                  // narration in the source language; support language generated from it
}

/** A small, generic manipulable. The player renders each kind with one component. */
export type Interactive =
  | { kind: 'parameter_sweep'; prompt: string; inputs: SweepInput[]; outputs: SweepOutput[]; plot?: { x: string; y: string } }
  | { kind: 'step_through'; prompt: string; steps: { label: string; detail: string }[] }
  | { kind: 'label_parts'; prompt: string; visualRef: 'explanation'; parts: { label: string; hint: string }[] }
  | { kind: 'sort_steps'; prompt: string; correctOrder: string[] }
  | { kind: 'compare_toggle'; prompt: string; options: { label: string; shows: string }[] }
  | { kind: 'simulation'; prompt: string; practicalId: Id };

export interface SweepInput { name: string; label: string; unit: string; min: number; max: number; step: number; default: number }
/** formula: an arithmetic expression over input names (+ - * / ^, exp, log, sqrt, abs, min, max, pi). */
export interface SweepOutput { name: string; label: string; unit: string; formula: string; decimals?: number }

export interface Example {
  title: string;
  scenario: string;
  takeaway: string;
  from?: SourceRef;
}

export interface RubricCriterion {
  criterion: string;
  marks: number;
  objectiveId?: Id;
}

export interface WorkedQuestion {
  id: Id;
  prompt: string;
  type: QuestionType;
  marks: number;
  modelAnswer: string[];        // line by line, as the student should write it
  rubric: RubricCriterion[];    // concept marks only; must add up to marks
  examVocabulary: Id[];         // term ids the answer must use correctly
  from?: SourceRef;             // e.g. a past-paper question
}

export interface CheckQuestion {
  id: Id;
  type: QuestionType;
  dimension: Dimension;
  prompt: string;
  options?: string[];           // mcq, multi_select, term_match, order_steps
  answer: string;               // the correct option, value, order, or a model answer
  acceptable?: string[];        // other answers that count (fill_blank, short answers)
  unit?: string;                // numerical
  tolerance?: { kind: 'percent' | 'absolute'; value: number };
  rubric?: RubricCriterion[];   // long_written, derivation, diagram
  explanation: string;          // shown after answering
  objectiveIds: Id[];           // owned by this concept
  difficulty: 1 | 2 | 3;
  marks?: number;
  from?: SourceRef;
}

/* ------------------------------------------------------------------ */
/* Practical work (generalises "lab")                                   */
/* ------------------------------------------------------------------ */

export interface FaultCard {
  id: Id;
  type: FaultType;
  symptom: string;              // what the student sees
  cause: string;
  fix: string;
  misconceptionId?: Id;
  difficulty: 1 | 2 | 3;
}

export interface Practical {
  id: Id;
  title: string;
  kind: PracticalKind;
  conceptIds: Id[];
  tool?: { name: string; url?: string; hasTour: boolean };
  aim: string;
  apparatus?: string[];
  steps: { n: number; instruction: string; showMe: boolean; checkpoint?: string }[];
  observations?: { columns: string[]; rows: number };
  expected: string;             // what a correct result looks like
  predictionPrompt?: string;    // "Draw what you expect before you run it"
  faultCards: FaultCard[];
  vivaPrompts: string[];        // questions an examiner asks about this practical
  experimentSheetDocId?: Id;    // the class's own sheet, when uploaded
  sources: SourceRef[];
}

/* ------------------------------------------------------------------ */
/* The ledger file: one lesson plan with everything it needs            */
/* ------------------------------------------------------------------ */

export interface Ledger {
  schema: 'lesson-ledger/v2';
  subjectProfile: SubjectProfile;
  course: Course;
  examProfile?: ExamProfile;
  englishRubric?: EnglishRubric;
  pastPapers?: PastPaper[];
  pastQuestions?: PastQuestion[];
  lessonPlan: LessonPlan;
  broadConcepts: BroadConcept[];
  concepts: Concept[];
  objectives: Objective[];
  terms: Term[];
  practicals: Practical[];
}

/**
 * The lesson player builds a concept's beats from the data; nothing is authored per beat.
 * A beat is skipped when its data is missing (no interactive → no explore; no practical → no lab tease).
 */
export type BeatKind =
  | 'hook'        // canDo + example.title as a teaser + exam signal
  | 'explain'     // explanation in defaultModality (walkthrough, text + visual, or video)
  | 'explore'     // explanation.modalities.interactive
  | 'example'     // example card
  | 'check'       // concept-dimension checks
  | 'collect'     // words checks; collected terms become word stickers
  | 'worked'      // worked question revealed line by line with its rubric
  | 'english'     // an english-dimension check (short_english or long_written; snap for long answers)
  | 'say'         // a spoken check, or Teach Kiki
  | 'practical';  // practical tease, when the concept has a practicalId
