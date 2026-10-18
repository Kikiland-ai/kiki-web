import { z } from 'zod';

const Id = z.string().min(1).max(128);
const Text = z.string().max(4000);
const Checkpoint = z.string().regex(/^CP-DSB-(0[1-9]|1[0-2])$/);
const Integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Action = z.object({
  id: Id, title: Text, where: Text.nullish(), how: z.array(Text).max(20).optional(),
  settings: z.array(z.object({ field: Text, value: Text })).max(30).optional(),
  expected_result: Text.nullish(), already_done_help: Text.nullish(), verification_only: z.boolean().optional(),
}).passthrough();
export const ExecutionContextSchema = z.object({
  lab_session_id: Id, checkpoint_id: Checkpoint.nullable(), visit_id: Id.nullable(),
  workspace_id: Id, capture_epoch: Integer, view_revision: Integer,
  parameter_revision: Integer, condition: z.string().max(80), lab_revision: Integer.optional(),
});
const Finding = z.object({ status: z.enum(['match', 'mismatch', 'unknown']), evidence: Text }).passthrough();
const SourceFrame = z.object({
  frame_id: Id, sha256: z.string().regex(/^[a-f0-9]{64}$/), server_received_at: z.string(),
  server_received_unix: z.number().optional(), server_received_unix_ms: z.number().optional(),
}).passthrough();
const Candidate = z.object({
  observation_id: Id, summary: Text, criteria: z.array(Finding).optional(),
  action_findings: z.array(Finding).optional(), uncertainties: z.array(Text).optional(),
  source_frame: SourceFrame, admitted_context: ExecutionContextSchema, completed_at: z.string().optional(),
}).passthrough();
const CriterionId = z.string().regex(/^CP-DSB-(0[1-9]|1[0-2]):[a-z_]+$/);
export const ResponseKindSchema = z.enum(['prediction', 'observation', 'explanation', 'question', 'note']);
export type ResponseKind = z.infer<typeof ResponseKindSchema>;
const Step = z.object({ checkpoint_id: Checkpoint, current_visit_id: Id.nullish(),
  criteria: z.array(z.object({ criterion_id: CriterionId, state: z.string().max(80), completion_basis: z.string().max(100).optional() }).passthrough()).max(12).optional(),
}).passthrough();
export const ExecutionRequirementsSchema = z.object({
  schema: z.literal('lab-input-requirements/v1'), preparationId: z.string(), backendLabId: Id,
  definitionSha256: z.string().regex(/^[a-f0-9]{64}$/), policySchema: z.literal('screen-guided-policy/v2'),
  checkpoints: z.array(z.object({ id: Checkpoint, condition: z.enum(['baseline', 'phase_fault', 'restored_baseline']), responsePrompt: z.string().max(2000).nullable(),
    criteria: z.array(z.object({ id: CriterionId, description: z.string().min(1).max(2000), responseKinds: z.array(ResponseKindSchema).max(5) })).min(1).max(12),
  })).length(12),
}).superRefine((value, ctx) => {
  if (new Set(value.checkpoints.map(cp => cp.id)).size !== 12 || value.checkpoints.some(cp => new Set(cp.criteria.map(c => c.id)).size !== cp.criteria.length || cp.criteria.some(c => !c.id.startsWith(cp.id + ':'))))
    ctx.addIssue({ code: 'custom', message: 'Invalid lab criterion identities.' });
});
export type ExecutionRequirements = z.infer<typeof ExecutionRequirementsSchema>;

/** Python field names stay authoritative. Compatibility normalization happens here only. */
export const LabExecutionStateSchema = z.object({
  schema: z.literal('lab-python/v1'), lab_session_id: Id, experiment_id: z.literal('PR-AM-DSB'),
  revision: z.number().int().positive(), status: z.enum(['active', 'paused', 'completed']),
  projection: z.literal('committed-decision/v1').optional(), current_visit_id: Id.nullish(),
  definition: z.object({ definition_sha256: z.string().regex(/^[a-f0-9]{64}$/) }).passthrough().optional(),
  responses: z.array(z.object({ id: Id, kind: ResponseKindSchema, text: z.string().max(2000), checkpoint_id: Checkpoint, visit_id: Id, interpretation: z.string().max(100).optional() }).passthrough()).max(100).optional(),
  workspace: z.object({
    id: Id, capture_session_id: Id.nullable(), capture_epoch: Integer,
    view_revision: Integer, parameter_revision: Integer, condition: z.string().max(80),
  }).passthrough(),
  queue: z.object({ current_checkpoint_id: Checkpoint.nullable(), upcoming_checkpoint_ids: z.array(Checkpoint), done_checkpoint_ids: z.array(Checkpoint) }),
  guidance: z.object({
    state: z.string().max(80), instruction: Text.nullish(), reason: Text.nullish(),
    current_action: Action.nullish(), next_action: Action.nullish(), next_instruction: Text.nullish(),
    action_position: Integer.nullish(), procedure: z.array(Action).optional(),
    procedure_version: z.string().optional(), already_tracked: Text.nullish(),
  }).passthrough(),
  steps: z.union([z.record(z.string(), Step), z.array(Step)]),
  runtime: z.object({
    capture_active: z.boolean().optional(), capture_status: z.string().optional(),
    analysis_status: z.string().max(80), analysis_error: z.string().nullish(),
    retry_after_ms: z.number().nonnegative().optional(), candidate: Candidate.nullish(),
    last_analysis_timing: z.object({ frame_id: Id.optional() }).passthrough().optional(),
  }).passthrough(),
  observation: z.object({ observation_id: Id, age_ms: z.number().nonnegative().nullable().optional() }).passthrough().nullable(),
}).passthrough().transform(state => ({
  ...state,
  runtime: {
    ...state.runtime,
    // Python's full state has capture_status; the committed projection omits it.
    // Its server-authored guidance still explicitly distinguishes disconnected reads.
    capture_active: state.runtime.capture_active ?? (state.runtime.capture_status !== undefined
      ? state.runtime.capture_status === 'sharing'
      : Boolean(state.workspace.capture_session_id && ['current_step', 'waiting_for_observation'].includes(state.guidance.state))),
    candidate: state.runtime.candidate ? { ...state.runtime.candidate, source_frame: {
      ...state.runtime.candidate.source_frame,
      server_received_unix_ms: state.runtime.candidate.source_frame.server_received_unix_ms
        ?? (state.runtime.candidate.source_frame.server_received_unix === undefined ? undefined : state.runtime.candidate.source_frame.server_received_unix * 1000),
    } } : null,
  },
}));
export type LabExecutionState = z.infer<typeof LabExecutionStateSchema>;
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
export type ExecutionCandidate = NonNullable<LabExecutionState['runtime']['candidate']>;
export const ExecutionEnvelopeSchema = z.object({
  schema: z.literal('lab-execution/v1'), preparationId: z.string().regex(/^prep-[a-f0-9-]{36}$/),
  backendLabId: Id, state: LabExecutionStateSchema,
}).superRefine((value, ctx) => {
  if (value.backendLabId !== value.state.lab_session_id) ctx.addIssue({ code: 'custom', message: 'Execution identity mismatch.' });
});
export const CaptureSessionSchema = z.object({ session_id: Id, sample_interval_ms: z.number().min(1000), max_frame_bytes: z.number().positive().max(1_000_000), session_limit_seconds: z.number().positive().nullable() });
export const FrameReceiptSchema = z.object({
  frame_id: Id, sha256: z.string().regex(/^[a-f0-9]{64}$/), width: Integer, height: Integer,
  byte_count: Integer, view_revision: Integer,
}).passthrough();
export type FrameReceipt = z.infer<typeof FrameReceiptSchema>;
/** Python declines a frame sent inside its admission spacing; it carries no retry hint. */
export const FrameSkippedSchema = z.object({ type: z.literal('skipped'), reason: z.string().max(80) });
export interface FrameMetadata {
  type: 'frame'; capture_epoch: 1; view_revision: number; sequence: number;
  captured_elapsed_ms: number; width: number; height: number; source_width: number; source_height: number;
  byte_count: number; mime_type: 'image/jpeg';
}
export interface FrameChannel {
  ready: Promise<void>;
  /** Resolves null when the receiver skipped the frame; the session stays connected. */
  sendFrame(metadata: FrameMetadata, image: Blob): Promise<FrameReceipt | null>;
  command(type: 'capture_started' | 'pause' | 'resume' | 'stop' | 'heartbeat'): Promise<void>;
  close(): void;
}
export type ContextCommand = { revision: number; action: 'pause' | 'resume' | 'view_changed' | 'parameters_changed' | 'condition' | 'revisit'; view_revision?: number; checkpoint_id?: string; condition?: 'baseline' | 'phase_fault' | 'restored_baseline' };
export interface LabExecutionApi {
  readonly targetOrigins?: readonly string[];
  start(prepId: string, signal?: AbortSignal): Promise<LabExecutionState>;
  recover(prepId: string, signal?: AbortSignal): Promise<LabExecutionState>;
  get(prepId: string, signal?: AbortSignal): Promise<LabExecutionState>;
  requirements(prepId: string, signal?: AbortSignal): Promise<ExecutionRequirements>;
  screen(prepId: string, signal?: AbortSignal): Promise<z.infer<typeof CaptureSessionSchema>>;
  channel(prepId: string, sid: string, onDisconnect: () => void, signal?: AbortSignal): Promise<FrameChannel>;
  attach(prepId: string, revision: number, sid: string, signal?: AbortSignal): Promise<LabExecutionState>;
  context(prepId: string, command: ContextCommand, signal?: AbortSignal): Promise<LabExecutionState>;
  check(prepId: string, body: { revision: number; frame_id: string; view_revision: number }, signal: AbortSignal): Promise<Response>;
  review(prepId: string, body: { revision: number; criterion_ids: string[]; review_note: string }, signal?: AbortSignal): Promise<LabExecutionState>;
  respond(prepId: string, body: { revision: number; kind: 'prediction' | 'observation' | 'explanation' | 'question' | 'note'; text: string; self_confidence?: number }, signal?: AbortSignal): Promise<LabExecutionState>;
}
