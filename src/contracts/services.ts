/**
 * Service interfaces, v0.3 (draft for review). Screens call these and nothing
 * else: no feature screen talks to fetch, Firestore or Firebase Auth directly.
 *
 * Each interface has two implementations behind one switch (VITE_APP_MODE):
 * a fixture adapter (labelled sample data) and the real API adapter.
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

export type AuthState =
  | { status: 'checking' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; uid: Id; displayName: string }

/** Registered by features that hold live resources (audio, capture, overlay, lab lease). */
export type SignOutCleanup = () => Promise<void> | void

export interface AuthService {
  /** Calls back immediately with the current state, then on every change. Returns unsubscribe. */
  onChange(listener: (state: AuthState) => void): () => void
  /** The only sign-in action: "Sign in with Google". */
  signInWithGoogle(options: { sharedDevice: boolean }): Promise<void>
  /**
   * Sign-out order:
   * 1. run every registered cleanup (stop audio, stop capture/overlay, release lab lease);
   *    a failed release must not block the rest, because the lease also expires server-side
   * 2. unsubscribe listeners and clear private drafts and caches
   * 3. Firebase sign-out
   * MathWorks keeps its own separate sign-in; the UI says so.
   */
  signOut(): Promise<void>
  /** Returns an unregister function. */
  registerSignOutCleanup(cleanup: SignOutCleanup): () => void
  /** Fresh Firebase ID token for the Authorization header. */
  getIdToken(): Promise<string>
}

export interface LearnerApi {
  bootstrap(): Promise<LearnerProfile>
  getProfile(): Promise<LearnerProfile>
  updateProfile(update: ProfileUpdate): Promise<LearnerProfile>
}

export interface LearningApi {
  getChapter(planId: Id): Promise<ChapterView>
  getConceptLesson(conceptId: Id): Promise<ConceptLesson>
  getProgress(planId: Id): Promise<ChapterProgress>
  savePosition(conceptId: Id, placardId: Id): Promise<ConceptProgress>
}

export interface AssessmentApi {
  start(assessmentId: Id): Promise<AssessmentRun>
  get(runId: Id): Promise<AssessmentRun>
  submit(runId: Id, submission: AssessmentSubmission): Promise<QuizResult>
  getResult(runId: Id): Promise<QuizResult>
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
  /** Show the pointer for one checkpoint. Only call when session.pointer.active; the student performs the action. */
  guide(checkpointId: Id): void
  /** Hides the pointer immediately and stops capture. */
  stop(): void
}
