/**
 * Kiki API contract, v0.3 (draft for review, 14 Oct 2026). Explained in docs/CONTRACT.md.
 *
 * These shapes are the agreement between the web app and the Python API.
 * The backend mirrors them in Pydantic; once it publishes OpenAPI, generate
 * this file from that schema instead of editing it by hand.
 *
 * Conventions
 * - JSON fields are camelCase. Pydantic models use snake_case attributes with
 *   a camelCase alias generator, so Python code stays idiomatic.
 * - Every success body is wrapped in one named key, following the existing
 *   `{ profile: … }` pattern: `{ chapter }`, `{ lesson }`, `{ session }`, …
 *   The `*Response` types below are the exact bodies.
 * - Paths are relative to VITE_API_BASE_URL, which includes the version
 *   prefix (e.g. http://127.0.0.1:8000/v1), so paths carry no /v1.
 * - Content ids and fields follow data-model/types/*.ts.
 */

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export type Id = string
/** ISO 8601 timestamp with offset. Server time is authoritative. */
export type Timestamp = string

export type Dimension = 'concept' | 'words' | 'english' | 'lab'
export type LanguageCode = 'en' | 'or'

export interface BilingualText {
  en: string
  or: string
}

/** Student-controlled support level. 1 = most Odia support, 5 = English text. */
export type DialLevel = 1 | 2 | 3 | 4 | 5

export interface SourceRef {
  origin: string
  label: string
  url?: string
}

/** Every error response body. HTTP status codes follow the code. */
export interface ApiError {
  error: {
    code: ApiErrorCode
    message: string
    /** Echoed for support; never contains tokens or learner content. */
    requestId?: string
  }
}

export type ApiErrorCode =
  | 'unauthenticated' //       401: missing or expired Firebase ID token
  | 'forbidden' //             403: record belongs to another learner
  | 'not_found' //             404
  | 'invalid_request' //       400/422: payload failed validation
  | 'stale_revision' //        409: lab session changed; reload and retry
  | 'lease_held' //            409: another device controls this lab session
  | 'lease_expired' //         409: this device's control lapsed; take control again
  | 'handoff_expired' //       410: copied session link is no longer valid
  | 'insufficient_evidence' // 409: e.g. required concept checks not passed
  | 'needs_confirmation' //    409: client must confirm before continuing
  | 'unsupported_workspace' // 409: wrong Simulink tab/model
  | 'unavailable' //           503: retry later

/* ------------------------------------------------------------------ */
/* Learner profile                                                     */
/* ------------------------------------------------------------------ */

/** The learner id is always the Firebase Auth UID, derived server-side from the token. */
export interface LearnerProfile {
  uid: Id
  displayName: string
  supportLanguage: 'or'
  dialLevel: DialLevel
  onboarding: {
    step: 'language' | 'confidence' | 'sentence_preference' | 'dial' | 'done'
    completedAt?: Timestamp
    /**
     * Self-ratings out of 10. Confidence only, never assessment evidence.
     * Same two inputs the backend speech pipeline takes
     * (odia_proficiency, english_proficiency).
     */
    selfRatings?: { odiaProficiency: number; englishProficiency: number }
  }
  courseIds: Id[]
  createdAt: Timestamp
}

export interface ProfileUpdate {
  dialLevel?: DialLevel
  onboarding?: Partial<LearnerProfile['onboarding']>
}

export interface ProfileResponse {
  profile: LearnerProfile
}

/* ------------------------------------------------------------------ */
/* Chapter and lessons (read-only content, no answer keys)             */
/* ------------------------------------------------------------------ */

export interface ChapterConcept {
  id: Id
  order: number
  broadConceptId: Id
  title: BilingualText
  canDo: string
  prerequisiteIds: Id[]
  requiredForLab: boolean
  estMinutes: number
  /** Concept-check assessment for this concept, e.g. AS-AM-04. */
  assessmentId: Id
}

export interface ChapterView {
  planId: Id
  courseId: Id
  title: BilingualText
  broadConcepts: { id: Id; title: BilingualText; order: number }[]
  concepts: ChapterConcept[]
  chapterAssessmentId: Id
  practicalId?: Id
  /** Content and Odia text are drafts until reviewed; the UI labels drafts. */
  review: { content: 'draft' | 'reviewed'; odia: 'draft' | 'reviewed' }
}

export type PlacardKind = 'definition' | 'concept' | 'application' | 'recap'

export interface Placard {
  id: Id
  kind: PlacardKind
  title: BilingualText
  body: BilingualText
  termIds: Id[]
  sources: SourceRef[]
}

/** Term details are available at every dial level, including 5. */
export interface LessonTerm {
  id: Id
  /** Canonical English spelling; never translated. */
  term: string
  definition: string
  symbol?: string
  unit?: string
  /** English term's pronunciation in Odia script. */
  pronunciationOr?: string
  /** Odia meaning. */
  glossOr?: string
  example?: BilingualText
}

export interface ConceptLesson {
  conceptId: Id
  planId: Id
  title: BilingualText
  keyIdea: BilingualText
  /** Always four, in order: definition, concept, application, recap. */
  placards: Placard[]
  terms: LessonTerm[]
  example: { title: BilingualText; scenario: BilingualText; takeaway: BilingualText }
  /** Media is optional; text placards always work without it. */
  media: {
    status: 'none' | 'pending' | 'ready' | 'failed'
    posterUrl?: string
    audioUrl?: string
    /** Labelled in the UI unless generated and reviewed. */
    narrationKind?: 'generated' | 'recorded' | 'fixture'
    /** Narration timing exists only when real alignment was produced. */
    timing?: 'none' | 'clip_duration_only' | 'sentence_aligned'
  }
  assessmentId: Id
}

export interface ChapterResponse {
  chapter: ChapterView
}

export interface LessonResponse {
  lesson: ConceptLesson
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export type TheoryCheckStatus = 'not_attempted' | 'revisit' | 'passed'

/** Coverage of assigned work. null = not assessed yet (never shown as 0%). */
export type DimensionCoverage = { done: number; total: number } | null

export interface ConceptProgress {
  conceptId: Id
  /** Not started / Learning / Revisit / Theory check passed. */
  status: 'not_started' | 'learning' | 'revisit' | 'passed'
  theoryCheck: { status: TheoryCheckStatus; latestRunId?: Id; attemptPercent?: number }
  /** Last placard the student was on, so lessons resume in place. */
  position?: { placardId: Id; updatedAt: Timestamp }
}

/** Mirrors requiredConceptReadiness() in data-model/runtime/learning-case.js. */
export interface LabReadiness {
  practicalId: Id
  /** True only when every required concept's latest concept check passed at >= 60%. */
  ready: boolean
  requiredConceptIds: Id[]
  missingConceptIds: Id[]
  evidenceRunIds: Id[]
  /** Always false for DSB-SC: the 80% chapter test never gates the lab. */
  chapterTestRequired: false
}

export interface ChapterProgress {
  planId: Id
  concepts: ConceptProgress[]
  chapterTest: { status: TheoryCheckStatus; latestRunId?: Id; attemptPercent?: number }
  rings: Record<Dimension, DimensionCoverage>
  labReadiness?: LabReadiness
}

export interface PositionUpdate {
  placardId: Id
}

export interface ProgressResponse {
  progress: ChapterProgress
}

export interface PositionResponse {
  position: ConceptProgress
}

/* ------------------------------------------------------------------ */
/* Assessments (Akshita's screens, backend scoring)                    */
/* ------------------------------------------------------------------ */

export interface AssignedQuestion {
  questionId: Id
  conceptId: Id
  prompt: BilingualText
  /** Same order and meaning in both languages; answers use the index. */
  options: { en: string[]; or: string[] }
}

/** Questions without answers or explanations. Created by the server. */
export interface AssessmentRun {
  runId: Id
  assessmentId: Id
  scope: 'concept' | 'chapter'
  attemptNumber: number
  passPercent: 60 | 80
  questions: AssignedQuestion[]
  createdAt: Timestamp
}

export interface StartAssessmentRequest {
  assessmentId: Id
}

export interface AssessmentSubmission {
  responses: { questionId: Id; optionIndex: number }[]
}

/** Mirrors scoreQuiz() in data-model/runtime/learning-case.js. */
export interface QuizResult {
  runId: Id
  assessmentId: Id
  correct: number
  total: number
  percent: number
  passPercent: 60 | 80
  /** Computed as correct * 100 >= passPercent * total, never from a rounded percent. */
  passed: boolean
  byConcept: Record<Id, { correct: number; total: number; missedQuestionIds: Id[] }>
  revisitConceptIds: Id[]
  nextAction: 'continue' | 'revisit_then_retry'
  /** Shown after submission only. */
  feedback: { questionId: Id; correct: boolean; explanation: BilingualText }[]
  completedAt: Timestamp
}

export interface RunResponse {
  run: AssessmentRun
}

export interface ResultResponse {
  result: QuizResult
}

/* ------------------------------------------------------------------ */
/* Lab sessions (Arpan's screens, backend session authority)           */
/* ------------------------------------------------------------------ */

export type LabSessionStatus =
  | 'preparing' //    required concept checks still missing
  | 'ready' //        checks passed; software not connected
  | 'connecting' //   software opened, waiting for workspace/observation
  | 'active' //       Kiki is guiding
  | 'paused'
  | 'disconnected' // sharing stopped, lease lost or wrong workspace
  | 'completed'

export type ConnectionState = 'inactive' | 'connecting' | 'active' | 'paused' | 'disconnected'

export interface LabCheckpointView {
  id: Id
  stepNumber: number
  targetLabel: string
  instruction: BilingualText
  why: BilingualText
  expected: string
  evidenceKind:
    | 'workspace'
    | 'model_structure'
    | 'parameters'
    | 'run_result'
    | 'waveform'
    | 'observation'
    | 'explanation'
  prerequisiteCheckpointIds: Id[]
}

export interface LabEvidence {
  id: Id
  checkpointId: Id
  /** Only 'integration' or 'screenshot_review' can be verified; a student tick is self-report. */
  source: 'integration' | 'screenshot_review' | 'student_report'
  verdict: 'verified' | 'needs_review' | 'rejected'
  summary: string
  capturedAt: Timestamp
}

export interface LabObservation {
  id: Id
  condition: string
  result: string
  receiverPhaseOffsetDeg?: number
  source: 'student_report' | 'integration'
  createdAt: Timestamp
}

/** Why the pointer is off. Mirrors pointerActivation() reasons. */
export type PointerBlockReason =
  | 'experiment_not_selected'
  | 'required_concepts_not_passed'
  | 'software_not_opened'
  | 'workspace_not_confirmed'
  | 'observation_not_enabled'
  | 'connection_not_active'
  | 'session_not_active'
  | 'no_controlling_device'
  | 'lease_expired'

export interface LabSession {
  id: Id
  practicalId: Id
  status: LabSessionStatus
  /** Increments on every accepted change. Mutations must send the revision they saw. */
  revision: number
  readiness: LabReadiness
  software: { opened: boolean; workspaceConfirmed: boolean; projectRef?: string; projectSaved?: boolean }
  connection: { state: ConnectionState; consentGranted: boolean }
  /** Device allowed to advance checkpoints. Every other device observes read-only. */
  control: {
    controllingDeviceId?: Id
    leaseExpiresAt?: Timestamp
    /** Server-chosen; the client heartbeats at this interval. Initial trial: 10s, lease 30s. */
    heartbeatSeconds: number
  }
  /**
   * Server-computed. The UI shows the live pointer only when active is true:
   * readiness passed, software and workspace verified, connection active,
   * and this device holds an unexpired lease.
   */
  pointer: { active: boolean; reasons: PointerBlockReason[] }
  currentCheckpointId?: Id
  checkpoints: LabCheckpointView[]
  evidence: LabEvidence[]
  observations: LabObservation[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A copied session link. It locates a session; it never grants access by itself. */
export interface SessionHandoff {
  id: Id
  sessionId: Id
  /** App path to open on the other device, e.g. /labs/{sessionId}?handoff={id}. */
  path: string
  savedRevision: number
  expiresAt: Timestamp
}

/** Every lab mutation sends the device and the revision it was based on. */
export interface LabMutationBase {
  deviceId: Id
  expectedRevision: number
}

export interface StartLabRequest {
  practicalId: Id
  deviceId: Id
}

export interface TakeControlRequest extends LabMutationBase {
  /** Present when opened from a copied link; the server checks owner, expiry and revision. */
  handoffId?: Id
}

export interface ConnectionUpdate extends LabMutationBase {
  software?: Partial<LabSession['software']>
  connection?: Partial<LabSession['connection']>
}

export interface CheckpointEvidenceRequest extends LabMutationBase {
  checkpointId: Id
  source: LabEvidence['source']
  summary: string
}

export interface ObservationRequest extends LabMutationBase {
  condition: string
  result: string
  receiverPhaseOffsetDeg?: number
}

export interface SessionResponse {
  session: LabSession
}

export interface HandoffResponse {
  handoff: SessionHandoff
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

/**
 * All requests send `Authorization: Bearer <Firebase ID token>` (except /health).
 * POSTs that can be retried send `Idempotency-Key: <uuid>`.
 * Format: METHOD path  //  request body -> response body.
 */
export const endpoints = {
  health: 'GET /health', //                                        -> { ok, mode, schema }

  // Profile (matches the existing app)
  bootstrap: 'POST /learners/me/bootstrap', //                       -> ProfileResponse (safe to repeat)
  getProfile: 'GET /learners/me/profile', //                         -> ProfileResponse
  updateProfile: 'PATCH /learners/me/profile', //                    ProfileUpdate -> ProfileResponse

  // Content
  chapter: 'GET /lesson-plans/{planId}', //                          -> ChapterResponse
  conceptLesson: 'GET /concepts/{conceptId}/lesson', //              -> LessonResponse

  // Progress
  progress: 'GET /learners/me/progress?planId={planId}', //          -> ProgressResponse
  savePosition: 'PUT /learners/me/positions/{conceptId}', //         PositionUpdate -> PositionResponse

  // Assessments
  startAssessment: 'POST /assessment-runs', //                       StartAssessmentRequest -> RunResponse
  getAssessment: 'GET /assessment-runs/{runId}', //                  -> RunResponse
  submitAssessment: 'POST /assessment-runs/{runId}/submit', //       AssessmentSubmission -> ResultResponse
  getResult: 'GET /assessment-runs/{runId}/result', //               -> ResultResponse

  // Lab sessions
  startLab: 'POST /lab-sessions', //                                 StartLabRequest -> SessionResponse (returns the active one if it exists)
  activeLab: 'GET /lab-sessions/active?practicalId={practicalId}', // -> SessionResponse, or 404
  getLab: 'GET /lab-sessions/{sessionId}', //                        -> SessionResponse
  takeControl: 'POST /lab-sessions/{sessionId}/take-control', //     TakeControlRequest -> SessionResponse
  heartbeat: 'POST /lab-sessions/{sessionId}/heartbeat', //          LabMutationBase -> SessionResponse (renews lease)
  release: 'POST /lab-sessions/{sessionId}/release', //              LabMutationBase -> SessionResponse (on sign-out/leave)
  createHandoff: 'POST /lab-sessions/{sessionId}/handoffs', //       LabMutationBase -> HandoffResponse
  updateConnection: 'POST /lab-sessions/{sessionId}/connection', //  ConnectionUpdate -> SessionResponse
  addEvidence: 'POST /lab-sessions/{sessionId}/evidence', //         CheckpointEvidenceRequest -> SessionResponse
  addObservation: 'POST /lab-sessions/{sessionId}/observations', //  ObservationRequest -> SessionResponse
  finishLab: 'POST /lab-sessions/{sessionId}/finish', //             LabMutationBase -> SessionResponse
} as const
