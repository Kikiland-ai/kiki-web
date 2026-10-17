/**
 * Service interfaces, v0.4 aligned with the current scaffold; Python sign-off pending. Screens call these and nothing
 * else: no feature screen talks to fetch, Firestore or Firebase Auth directly.
 *
 * Implemented interfaces use one switch (VITE_APP_MODE) for labelled fixture
 * adapters and real API adapters. Teaching/assessment/lab adapters remain pending.
 * Methods return the unwrapped value; adapters unwrap `{ profile }`, `{ session }`, ….
 */
import type {
  AssessmentRun,
  AssessmentSubmission,
  ChapterProgress,
  ChapterView,
  CheckpointEvidenceRequest,
  ConceptLesson,
  ConceptProgress,
  ConnectionUpdate,
  Id,
  LabMutationBase,
  LabSession,
  LearnerProfile,
  ObservationRequest,
  ProfileUpdate,
  QuizResult,
  SessionHandoff,
  TakeControlRequest,
} from './api'
import type { LabPreparationApi } from './lab-preparation'
import type { IntakeApi } from './intake'
import type { AssessmentOverview, DraftUpdate } from './assessment'
import type { MediaManifest, NarrationRendition } from './concept-media'

export interface Identity { uid: Id; displayName: string }

/** Cleanup must synchronously hide/stop local resources before awaiting network release. */
export type SignOutCleanup = () => Promise<void> | void

/** Preserve the working app’s auth interface; do not create a second auth store. */
export interface AuthService {
  subscribe(listener: (identity: Identity | null) => void, onError: (error: Error) => void): () => void
  signIn(options: { remember: boolean; redirect: boolean }): Promise<void>
  signOut(): Promise<void>
  registerSignOutCleanup(cleanup: SignOutCleanup): () => void
  getIdToken(forceRefresh?: boolean): Promise<string>
}

/** Concrete Firebase/fixture drivers are wrapped with the shared cleanup registry. */
export type AuthDriver = Omit<AuthService, 'registerSignOutCleanup'>

export interface LearnerApi {
  bootstrap(signal?: AbortSignal): Promise<LearnerProfile>
  getProfile(signal?: AbortSignal): Promise<LearnerProfile>
  updateProfile(update: ProfileUpdate, signal?: AbortSignal): Promise<LearnerProfile>
  enroll(courseId: Id, semester: number, signal?: AbortSignal): Promise<LearnerProfile>
}

/** Only auth and profile adapters are connected today; add feature services when implemented. */
export interface Services {
  mode: 'fixture' | 'connected'
  auth: AuthService
  api: LearnerApi
  intake: IntakeApi
  assessments: AssessmentApi
  learning: LearningApi
  media: MediaApi
  labPreparation: LabPreparationApi
}

export interface LearningApi {
  getChapter(planId: Id, signal?: AbortSignal): Promise<ChapterView>
  getConceptLesson(conceptId: Id, signal?: AbortSignal): Promise<ConceptLesson>
  getProgress(planId: Id, signal?: AbortSignal): Promise<ChapterProgress>
  savePosition(conceptId: Id, placardId: Id, signal?: AbortSignal): Promise<ConceptProgress>
}

/** A playable copy of one private asset; release() frees it (blob URLs are revocable). */
export interface LoadedMedia { url: string; release(): void }

/** Published, preprocessed lesson media. Reading never asks the server to generate anything. */
export interface MediaApi {
  /** Only for a lesson whose mediaExperience points at a published revision. */
  getManifest(conceptId: Id, signal?: AbortSignal): Promise<MediaManifest>
  loadNarration(conceptId: Id, mediaRevision: string, rendition: NarrationRendition, signal?: AbortSignal): Promise<LoadedMedia>
}

export interface AssessmentApi {
  start(assessmentId: Id, signal?: AbortSignal, operationKey?: string, previousRunId?: Id): Promise<AssessmentRun>
  get(runId: Id, signal?: AbortSignal): Promise<AssessmentRun>
  saveDraft(runId: Id, draft: DraftUpdate, signal?: AbortSignal, operationKey?: string): Promise<AssessmentRun>
  submit(runId: Id, submission: AssessmentSubmission, signal?: AbortSignal, operationKey?: string): Promise<QuizResult>
  getResult(runId: Id, signal?: AbortSignal): Promise<QuizResult>
  overview(planId: Id, signal?: AbortSignal): Promise<AssessmentOverview>
  /** Development-only, explicitly labelled prerequisite setup; never live evidence. */
  previewChapterReady?(): Promise<AssessmentOverview>
}

export interface LabApi {
  /** Returns the learner's active session for this practical if one exists. */
  start(practicalId: Id, deviceId: Id): Promise<LabSession>
  /** null when the learner has no active session (Home hides Resume lab). */
  getActive(practicalId: Id): Promise<LabSession | null>
  get(sessionId: Id): Promise<LabSession>
  takeControl(sessionId: Id, request: TakeControlRequest): Promise<LabSession>
  /** Call every session.control.heartbeatSeconds while this device controls the session. */
  heartbeat(sessionId: Id, request: LabMutationBase): Promise<LabSession>
  release(sessionId: Id, request: LabMutationBase): Promise<LabSession>
  createHandoff(sessionId: Id, request: LabMutationBase): Promise<SessionHandoff>
  updateConnection(sessionId: Id, update: ConnectionUpdate): Promise<LabSession>
  addEvidence(sessionId: Id, request: CheckpointEvidenceRequest): Promise<LabSession>
  addObservation(sessionId: Id, request: ObservationRequest): Promise<LabSession>
  finish(sessionId: Id, request: LabMutationBase): Promise<LabSession>
}

/**
 * Bridge to the Simulink extension. The extension is built separately;
 * this shape is provisional until its code is reviewed.
 */
export type LabConnectionStatus =
  | { state: 'extension_missing' }
  | { state: 'waiting_for_share' }
  | { state: 'wrong_workspace' }
  | { state: 'connected'; workspaceLabel: string }
  | { state: 'stopped'; reason: 'student_stopped' | 'tab_closed' | 'auth_lost' | 'lease_lost' | 'error' }

export interface LabConnectionAdapter {
  /** 'manual' = no live pointer; the tracker shows written steps, labelled "Manual guide". */
  readonly kind: 'extension' | 'manual'
  status(): LabConnectionStatus
  onStatus(listener: (status: LabConnectionStatus) => void): () => void
  /** Must run from a click: Chrome requires a user gesture to start capture. Never reuses old permission. */
  connect(sessionId: Id): Promise<void>
  /** Show the pointer for one checkpoint. Also require local device ownership, an unexpired lease and a fresh connected workspace; the student performs the action. */
  guide(checkpointId: Id): void
  /** Hides the pointer immediately and stops capture. */
  stop(): void
}

/** Register feature implementations through the app composition root, not global singletons.
 * These interfaces do not claim that teaching/assessment/lab adapters already exist.
 * Retried mutations must reuse one operation's Idempotency-Key; adapters own transport.
 */
export interface FeatureServices {
  learning: LearningApi
  assessments: AssessmentApi
  labs: LabApi
  labConnection: LabConnectionAdapter
}
