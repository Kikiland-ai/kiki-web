/** Additive case package: references a v2 ledger, without mixing personal sessions into content. */
import type { Id, Dimension, Review, SourceRef } from './content';
import type { Learner, ConceptState } from './learner';
import type { StudyRequest, SourceDoc } from './intake';

export interface BilingualText { en: string; or: string }

export interface Placard {
  id: Id;
  conceptId: Id;
  kind: 'definition' | 'concept' | 'application' | 'recap';
  title: BilingualText;
  body: BilingualText;
  termIds: Id[];
  visualRef?: 'explanation';
  sources: SourceRef[];
}

export interface QuestionTranslation {
  questionId: Id;
  language: 'or';
  prompt: string;
  options?: string[];           // same order/meaning as canonical options; correctness uses the index
  explanation: string;
  answerText?: string;          // for optional non-choice tasks only
}

export interface AssessmentDefinition {
  id: Id;
  scope: 'concept' | 'chapter';
  lessonPlanId: Id;
  conceptIds: Id[];
  questionIds: Id[];            // canonical CheckQuestion ids; answers stay in the ledger
  passPercent: 60 | 80;
  maxQuestions: 5 | 10;
  languageModes: ['or', 'en'];
  scoring: 'one_point_per_mcq';
  retry: { action: 'revisit_missed_concepts'; questionSelection: 'equivalent_unseen_when_available' };
}

export interface QuizRun {
  id: Id;
  learnerId: Id;
  assessmentId: Id;
  attemptNumber: number;
  responses: { questionId: Id; optionIndex: number }[];
  completedAt: string;
  previousRunId?: Id;
}

export interface SimulinkBlock {
  id: Id;
  library: string;
  label: string;
  parameters: Record<string, string>;
}

export interface LabCheckpoint {
  id: Id;
  stepNumber: number;
  target: { strategy: 'semantic'; surface: 'kiki_tracker' | 'simulink'; label: string };
  instruction: BilingualText;
  why: BilingualText;
  expected: string;
  evidenceKind: 'workspace' | 'model_structure' | 'parameters' | 'run_result' | 'waveform' | 'observation' | 'explanation';
  prerequisiteCheckpointIds: Id[];
}

export interface LabConfiguration {
  practicalId: Id;
  difficulty: 'medium';
  estimatedMinutes: number;
  executionVerified: boolean;   // true only after an actual external-model run is documented
  requiredConceptIds: Id[];
  entry: { preparation: 'anytime'; conceptPassPercent: 60; chapterPassRequired: false };
  software: { name: string; url: string; separateSignIn: true; products: string[] };
  simulation: {
    messageFrequencyHz: number;
    carrierFrequencyHz: number;
    carrierPhaseRad: number;
    receiverPhaseRad: number;
    lowpassCutoffHz: number;
    recoveryGain: number;
    stopTimeSec: number;
    solver: string;
    maxStepSec: number;
    lowpass: { numerator: number[]; denominator: number[] };
    expectations: { idealSidebandsHz: number[]; steadyStateMessageAmplitude: number; filterPhaseLagDegrees: number; phaseFaultOffsetDegrees: number };
  };
  blocks: SimulinkBlock[];
  connections: { fromBlockId: Id; fromPort: number; toBlockId: Id; toPort: number }[];
  checkpoints: LabCheckpoint[];
  pointer: {
    name: 'Hey Clickky 2.0';
    activationRequires: ['experiment_selected', 'required_concepts_passed', 'software_opened', 'workspace_confirmed', 'connection_active'];
    performsStudentActions: false;
    integrationStatus: 'unverified' | 'verified';
    targetResolution: 'resolve_against_current_workspace';
  };
  faultConfigurations: { faultCardId: Id; blockId: Id; parameter: string; baselineValue: string; faultValue: string; expectedChange: string }[];
  observationPrompts: BilingualText[];
  viva: { id: Id; prompt: BilingualText; answer: BilingualText; conceptIds: Id[] }[];
  sources: SourceRef[];
}

export type LabSessionStatus = 'preparing' | 'ready' | 'connecting' | 'active' | 'paused' | 'disconnected' | 'completed';
export interface LabEvidence {
  id: Id;
  checkpointId: Id;
  source: 'integration' | 'screenshot_review' | 'student_report';
  verdict: 'verified' | 'needs_review' | 'rejected';
  summary: string;
  capturedAt: string;
  assetRef?: string;            // reference only; raw screenshots/audio are separate owner-scoped assets
}

export interface LabSession {
  id: Id;
  ownerLearnerId: Id;
  practicalId: Id;
  status: LabSessionStatus;
  experimentSelected: boolean;
  software: { opened: boolean; workspaceConfirmed: boolean; projectRef?: string; projectSaved?: boolean };
  connection: { state: 'inactive' | 'connecting' | 'active' | 'paused' | 'disconnected'; surface: 'selected_simulink_workspace'; consentGranted: boolean };
  controllingDeviceId?: Id;
  observerDeviceIds: Id[];
  revision: number;
  lastSyncedRevision: number;
  currentCheckpointId?: Id;
  evidence: LabEvidence[];
  observations: { condition: string; messageHz?: number; carrierHz?: number; receiverPhaseOffsetDeg?: number; result: string; source: 'student_report' | 'integration' }[];
  language: 'or';
  createdAt: string;
  updatedAt: string;
}

export interface SessionHandoff {
  id: Id;
  labSessionId: Id;
  ownerLearnerId: Id;
  path: string;                 // locator, not a bearer token; the server must authenticate and authorize
  fromDeviceId: Id;
  toDeviceId: Id;
  savedRevision: number;
  expiresAt: string;
  authenticationRequired: true;
  sameOwnerRequired: true;
  transfersControl: true;
  externalProjectPolicy: 'required_if_software_opened';
}

export interface LearningCase {
  schema: 'learning-case/v1';
  id: Id;
  ledgerFile: string;
  courseId: Id;
  lessonPlanId: Id;
  practicalId: Id;
  contentReview: Review;
  odiaReview: { status: 'draft'; nativeSpeakerReviewed: false };
  ui: {
    defaultLearningLanguage: 'or'; interfaceLanguage: 'en';
    colours: Record<Dimension, 'green' | 'red' | 'yellow' | 'blue'>;
    labEntry: { placement: 'top_right'; label: 'Lab mode'; route: string; opens: 'lab_tracker'; pointerOnEntry: false };
    trackerFields: string[];
    layout: { mobile: 'single_column'; desktop: 'tracker_alongside_simulink' };
  };
  assessments: { concepts: AssessmentDefinition[]; chapter: AssessmentDefinition; auxiliaryQuestionIds: Id[]; englishRubricId?: Id };
  placards: Placard[];
  questionTranslations: QuestionTranslation[];
  conceptTranslations: {
    conceptId: Id;
    language: 'or';
    title: string;
    explanation: string;
    example: { title: string; scenario: string; takeaway: string };
    workedQuestion: { prompt: string; modelAnswer: string[] };
  }[];
  glossaryExamples: { termId: Id; sentence: BilingualText }[];
  practical: LabConfiguration;
  seeds: {
    synthetic: true;
    learner: Learner;
    requests: StudyRequest[];
    sourceDocs: SourceDoc[];
    quizRuns: QuizRun[];
    scoreExamples: QuizRun[];   // independent boundary examples, not the learner's chronological history
    conceptStates: ConceptState[];
    labSessions: LabSession[];
    handoffs: SessionHandoff[];
  };
}
