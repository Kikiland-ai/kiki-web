/** TypeScript port of kiki-backend's floating-guidance/v0.1 pure projector.
 * Python names and decisions stay authoritative; no inference or grading here.
 */
import type { ExecutionCandidate, LabExecutionState } from '../../contracts/lab-execution';

export const FG_SCHEMA = 'floating-guidance/v0.1';
export const FG_LIMITS = { text: 600, short: 160, list: 8, settings: 12, facts: 3, uncertainties: 2, message_chars: 24000 };
export const OBSERVATION_FRESH_MS = 20000;
const SCOPE = ['lab_session_id', 'checkpoint_id', 'visit_id', 'workspace_id', 'capture_epoch', 'view_revision', 'parameter_revision', 'condition'] as const;
const text = (value: unknown, max = FG_LIMITS.text) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const texts = (value: unknown, max = FG_LIMITS.list, size = FG_LIMITS.text): string[] => Array.isArray(value) ? value.map(v => text(typeof v === 'string' ? v : v?.text, size)).filter((s): s is string => Boolean(s)).slice(0, max) : [];
export type AcceptedObservation = Pick<ExecutionCandidate, 'observation_id' | 'summary' | 'source_frame' | 'admitted_context'> & {
  criteria: NonNullable<ExecutionCandidate['criteria']>; action_findings: NonNullable<ExecutionCandidate['action_findings']>;
  uncertainties: string[]; accepted_at?: string; base_age_ms: number | null; base_at: number;
};
export function currentScope(state: LabExecutionState) {
  const steps = Array.isArray(state.steps) ? state.steps : Object.values(state.steps);
  const step = steps.find(s => s.checkpoint_id === state.queue.current_checkpoint_id);
  return { lab_session_id: state.lab_session_id, checkpoint_id: state.queue.current_checkpoint_id, visit_id: step?.current_visit_id ?? state.current_visit_id ?? null,
    workspace_id: state.workspace.id, capture_epoch: state.workspace.capture_epoch, view_revision: state.workspace.view_revision,
    parameter_revision: state.workspace.parameter_revision, condition: state.workspace.condition };
}
function actionView(action: NonNullable<LabExecutionState['guidance']['current_action']>, checkpointId: string | null) {
  return { action_id: text(action.id, FG_LIMITS.short), checkpoint_id: checkpointId, title: text(action.title), where: text(action.where), how: texts(action.how),
    settings: (action.settings ?? []).slice(0, FG_LIMITS.settings).map(v => ({ field: text(v.field, 120), value: text(v.value, 120) })).filter(v => v.field && v.value),
    expected_result: text(action.expected_result), already_done_help: text(action.already_done_help), verification_only: action.verification_only === true };
}
export function acceptedFrom(state: LabExecutionState, previous: AcceptedObservation | null = null): AcceptedObservation | null {
  const c = state.runtime.candidate;
  if (c && state.runtime.analysis_status === 'available' && previous?.observation_id !== c.observation_id) return {
    observation_id: c.observation_id, summary: c.summary, criteria: c.criteria ?? [], action_findings: c.action_findings ?? [], uncertainties: c.uncertainties ?? [],
    source_frame: c.source_frame, admitted_context: c.admitted_context, accepted_at: c.completed_at,
    base_age_ms: state.observation?.observation_id === c.observation_id ? state.observation.age_ms ?? null : null, base_at: performance.now(),
  };
  return previous?.admitted_context.lab_session_id === state.lab_session_id ? previous : null;
}
export function observationAge(accepted: AcceptedObservation | null, now = performance.now()) {
  return accepted?.base_age_ms === null || !accepted ? null : accepted.base_age_ms + Math.max(0, now - accepted.base_at);
}
export function screenContext(state: LabExecutionState, accepted: AcceptedObservation | null, { ageMs = null, blockedReason = null }: { ageMs?: number | null; blockedReason?: string | null } = {}) {
  const scope = currentScope(state);
  let status = 'waiting', reason: string | null = null;
  if (state.status === 'completed') status = 'ended';
  else if (!state.runtime.capture_active) status = 'disconnected';
  else if (state.status === 'paused') status = 'paused';
  else if (blockedReason) { status = 'blocked'; reason = text(blockedReason, 220); }
  else if (state.runtime.analysis_status === 'waiting_for_provider') { status = 'unavailable'; reason = text(state.runtime.analysis_error, 80); }
  const base = { status, reason, observation_id: null as string | null, source_frame: null as AcceptedObservation['source_frame'] | null, observed_context: null as object | null,
    summary: null as string | null, summary_kind: null as string | null, visible: [] as string[], check: [] as string[], uncertainties: [] as string[], age_ms: null as number | null, fresh_for_ms: 0 };
  if (!accepted) return base;
  const age = ageMs === null || !Number.isFinite(ageMs) ? null : Math.max(0, ageMs);
  const matches = SCOPE.every(k => accepted.admitted_context[k] === scope[k]);
  const summary = text(accepted.summary, 300), fresh = status === 'waiting' && matches && age !== null && age < OBSERVATION_FRESH_MS;
  const findings = [...accepted.criteria, ...accepted.action_findings].filter(r => r.evidence.trim());
  const facts = (s: string) => [...new Set(findings.filter(r => r.status === s).map(r => text(r.evidence, 220)).filter((v): v is string => Boolean(v)))].slice(0, FG_LIMITS.facts);
  return { ...base, status: fresh ? 'fresh' : status === 'waiting' ? 'earlier' : status, observation_id: accepted.observation_id,
    source_frame: accepted.source_frame, observed_context: accepted.admitted_context, summary,
    summary_kind: summary?.startsWith('Visible:') ? 'visible' : summary?.startsWith('Check this:') ? 'check' : 'uncertainty',
    visible: facts('match'), check: facts('mismatch'), uncertainties: texts(accepted.uncertainties, FG_LIMITS.uncertainties, 220),
    context_matches: matches, age_ms: age, fresh_for_ms: fresh ? OBSERVATION_FRESH_MS - age : 0, accepted_at: accepted.accepted_at };
}
export type ProjectionInput = { state: LabExecutionState; accepted?: AcceptedObservation | null; ageMs?: number | null; reading?: boolean; retryAfterMs?: number | null; blockedReason?: string | null };
export function projectSnapshot(state: LabExecutionState, { accepted = null, ageMs = null, reading = false, retryAfterMs = null, blockedReason = null }: Omit<ProjectionInput, 'state'> = {}) {
  const guide = state.guidance, cp = state.queue.current_checkpoint_id;
  const now = state.status === 'completed' ? null : guide.current_action ? actionView(guide.current_action, cp) : { action_id: null, checkpoint_id: cp, title: text(guide.instruction), where: null, how: [], settings: [], expected_result: null, already_done_help: null, verification_only: false };
  const next = state.status === 'completed' ? null : guide.next_action ? { ...actionView(guide.next_action, cp), crosses_stage: false }
    : guide.next_instruction ? { action_id: null, checkpoint_id: state.queue.upcoming_checkpoint_ids[0] ?? null, title: text(guide.next_instruction), crosses_stage: true } : null;
  return { context: currentScope(state), lab_revision: state.revision, lab: { status: state.status, guidance_state: guide.state },
    instructions: { basis: 'authoritative_tracker', procedure_version: text(guide.procedure_version, 80), now, next, why: text(guide.reason), already_tracked: text(guide.already_tracked) },
    screen_context: screenContext(state, accepted, { ageMs, blockedReason }), runtime: { capture_active: state.runtime.capture_active, analysis_status: state.runtime.analysis_status,
      reading, retry_after_ms: retryAfterMs && retryAfterMs > 0 ? Math.round(retryAfterMs) : null },
    progress: { checkpoint_position: cp ? Number(cp.slice(-2)) : null, checkpoint_total: 12, action_position: guide.current_action ? guide.action_position ?? null : null,
      action_total: guide.procedure?.length ?? null, stages_tracked: state.queue.done_checkpoint_ids.length } };
}
export function contentKey(body: ReturnType<typeof projectSnapshot>) {
  const { screen_context, runtime, ...rest } = body;
  return JSON.stringify({ ...rest, runtime: { ...runtime, retry_after_ms: runtime.retry_after_ms === null ? null : Math.ceil(runtime.retry_after_ms / 5000) }, screen_context: { ...screen_context, age_ms: null, fresh_for_ms: null } });
}
