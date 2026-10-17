/**
 * Learner model: what we know about each student, keyed to content ids.
 *
 * Everything here points at Concept, Objective, Term, CheckQuestion, PastQuestion and Practical ids
 * from content.ts, so the map, the route, the rings, the receipt, the practice report and the repair map
 * all read the same facts. Nothing here is subject-specific.
 */
import type { Id, LangCode, Dimension, ExamKind, QuestionType } from './content';

export interface Learner {
  id: Id;
  displayName: string;
  supportLanguage: LangCode;    // 'or' for the pilot
  dialLevel: number;            // the student's current global setting; only the student moves it
  courseIds: Id[];
  classGroupIds: Id[];
  goals: Goal[];
  onboarding: {
    arrivedVia: 'smart_link' | 'direct' | 'share_card';
    smartLinkId?: Id;
    easyLanguageAnswer?: string;   // "which feels easy" answer that set the suggested dial
    beforeScore?: number;          // the "before" question, for before/after proof (1 to 5)
    completedAt?: string;
    fluencySelfRatings?: {
      support: { language: LangCode; outOf10: number };
      englishOutOf10: number;
      assessedBy: 'self';       // confidence only; never used as mastery evidence
    };
  };
  signedIn: boolean;            // true before onboarding in the current journey; false retained for legacy flows
  settings: {
    voice: boolean;
    autoplayWalkthrough: boolean;
    reminders: { enabled: boolean; time?: string; channel: 'push' | 'whatsapp' };
    dataSaver: boolean;
    offlinePackIds: Id[];
  };
  createdAt: string;
}

export interface Goal {
  id: Id;
  kind: 'exam' | 'practical' | 'understand' | 'question';
  courseId: Id;
  examKind?: ExamKind;
  date?: string;
  lessonPlanIds: Id[];          // what the goal covers; empty = whole course
  minutesPerDay?: number;
  active: boolean;
}

/** An ordered plan of concepts toward a goal. Kiki proposes it; the student can reorder or remove stops. */
export interface Route {
  id: Id;
  learnerId: Id;
  goalId: Id;
  stops: {
    conceptId: Id;
    reason: 'exam_weight' | 'prerequisite' | 'repair' | 'flicker' | 'student_added' | 'practical_soon';
    estMinutes: number;
    plannedFor?: string;        // ISO date
    done: boolean;
  }[];
  generatedAt: string;
  editedByStudent: boolean;
}

export interface DimState {
  score: number;                // 0 to 1, shown as the ring segment fill
  evidence: number;             // attempts that informed it
  updatedAt: string;
}

/** One row per learner per concept. A null dimension = not applicable (no practical in this subject). */
export interface ConceptState {
  learnerId: Id;
  conceptId: Id;
  dims: Record<Dimension, DimState | null>;
  status: 'not_started' | 'in_progress' | 'mastered' | 'flickering' | 'repair';
  lastStudiedAt?: string;
  nextReviewAt?: string;        // spaced review; past this date a mastered node flickers
  dialLevelsUsed: number[];
  hintsUsed: number;
  modalitiesUsed: ('textImage' | 'voice' | 'video' | 'interactive')[];
  theoryCheck?: {
    status: 'not_attempted' | 'revisit' | 'passed';
    latestQuizRunId?: Id;
    attemptPercent?: number;    // correctness on an attempt, not a certainty of complete mastery
  };
}

export type Verdict = 'both_ok' | 'language_gap' | 'concept_gap' | 'both_gap';
export type Level = 'ok' | 'partial' | 'not_yet' | 'n/a';

/** Every answer is judged on concept and English separately. This is the product's core promise. */
export interface Diagnosis {
  concept: Level;
  english: Level;
  words: Level;                 // were the exam terms used correctly
  verdict: Verdict;
  feedback: string;             // short, plain, "not yet" never "wrong"
  marks?: { span: string; kind: 'term' | 'idea' | 'english' | 'lab' }[];  // Kiki's word marks on the answer
}

export interface Attempt {
  id: Id;
  learnerId: Id;
  conceptId: Id;
  questionId: Id;               // CheckQuestion, WorkedQuestion or PastQuestion id
  context: 'lesson' | 'recharge' | 'practice' | 'retest' | 'viva' | 'practical' | 'snap';
  response:
    | { kind: 'choice'; value: string | string[] }
    | { kind: 'number'; value: number; unit?: string }
    | { kind: 'text'; value: string }
    | { kind: 'audio'; assetId: string; transcript?: string }
    | { kind: 'image'; assetIds: string[]; transcript?: string }
    | { kind: 'drawing'; assetId: string };
  dialLevel: number;
  hintsUsed: number;
  durationSec: number;
  diagnosis: Diagnosis;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Practice sets, handwriting marking and repair                        */
/* ------------------------------------------------------------------ */

export interface PracticeSet {
  id: Id;
  learnerId: Id;
  courseId: Id;
  kind: 'mock' | 'past_paper' | 'single' | 'chapter' | 'retest';
  title: string;
  questions: { ref: { kind: 'check' | 'worked' | 'past'; id: Id }; type: QuestionType; marks: number; conceptIds: Id[] }[];
  durationMin: number;
  totalMarks: number;
  builtFrom: string;            // "your route and your class's past papers"
  createdAt: string;
}

export interface Submission {
  id: Id;
  setId: Id;
  learnerId: Id;
  pageAssetIds: string[];
  status: 'snapped' | 'reading' | 'marking' | 'marked' | 'needs_retake';
  answers: MarkedAnswer[];
  totals: {
    concept: { got: number; outOf: number };
    english: Record<string, 'not_yet' | 'nearly' | 'exam_ready'>;  // per EnglishRubric criterion
    lostToLanguage: number;     // concept marks that were there in substance but unreadable in English
  };
  submittedAt: string;
  markedAt?: string;
}

export interface MarkedAnswer {
  questionIndex: number;
  pageSpans: { page: number; bbox: [number, number, number, number] }[];
  transcript: string;
  ocrConfidence: number;
  criteria: { criterion: string; awarded: number; outOf: number; evidence?: string }[];
  english: { key: string; level: 'not_yet' | 'nearly' | 'exam_ready'; note?: string }[];
  diagnosis: Diagnosis;
  repairItemIds: Id[];
}

export interface RepairPlan {
  id: Id;
  learnerId: Id;
  submissionId: Id;
  items: RepairItem[];
  retestSetId?: Id;
  createdAt: string;
}

export interface RepairItem {
  id: Id;
  target: { kind: 'objective' | 'term' | 'english_skill' | 'concept'; id: Id };
  conceptId: Id;
  why: string;                  // "You knew the idea but did not name the depletion region"
  fix: {
    kind: 'recharge' | 'lesson_beat' | 'term_practice' | 'worked_question' | 'write_again';
    ref?: Id;
    estMinutes: number;
  };
  status: 'todo' | 'done' | 'retested_ok' | 'retested_not_yet';
}

/* ------------------------------------------------------------------ */
/* Proof, words, practicals                                             */
/* ------------------------------------------------------------------ */

export interface Receipt {
  id: Id;
  learnerId: Id;
  conceptId: Id;
  before: number;               // self-rated or "before" question, 1 to 5
  after: number;
  dimsBefore: Record<Dimension, number | null>;
  dimsAfter: Record<Dimension, number | null>;
  termsCollected: Id[];
  englishSample?: { before?: string; after: string };   // first and best English answer, for ReceiptCompare
  shareCardAssetId?: string;
  createdAt: string;
}

export interface WordSticker {
  learnerId: Id;
  termId: Id;
  collectedAt: string;
  strength: 0 | 1 | 2 | 3;      // practised correctly in a row
  lastPractisedAt?: string;
}

export interface PracticalRun {
  id: Id;
  learnerId: Id;
  practicalId: Id;
  predictionAssetId?: string;
  stepsDone: number[];
  faultsFound: Id[];            // FaultCard ids
  observations?: string[][];
  vivaAttemptIds: Id[];
  status: 'started' | 'predicted' | 'ran' | 'debugged' | 'done';
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Teachers and classes                                                 */
/* ------------------------------------------------------------------ */

export interface ClassGroup {
  id: Id;
  courseId: Id;
  name: string;                 // "ECE 1st year, section B"
  teacherIds: Id[];
  learnerIds: Id[];
  smartLinkIds: Id[];
  examDates: { kind: ExamKind; date: string }[];
}

/** Aggregates only; a teacher never sees an individual's answers without the student sharing them. */
export interface ClassPulse {
  classGroupId: Id;
  conceptId: Id;
  learners: number;
  dims: Record<Dimension, number | null>;   // class mean, 0 to 1
  topVerdict: 'language_gap' | 'concept_gap' | 'mixed';
  commonMisconceptionIds: Id[];
  updatedAt: string;
}
