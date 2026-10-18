/** v2 stream: provisional prose is preview-only; only guidance_committed changes guidance. */
import { z } from 'zod';
import { ExecutionContextSchema, FrameReceiptSchema, LabExecutionStateSchema, type ExecutionContext, type FrameReceipt, type LabExecutionState } from '../../contracts/lab-execution';
import { ServiceError } from '../../services/types';

const EventSchema = z.object({
  schema: z.literal('lab-analysis-stream/v2'), request_id: z.string().min(1).max(128), event_sequence: z.number().int().positive(), type: z.string().max(80),
  context: ExecutionContextSchema.nullish(), current_context: ExecutionContextSchema.nullish(), frame: FrameReceiptSchema.optional(),
  state: LabExecutionStateSchema.optional(), revision: z.number().int().positive().optional(), provisional: z.boolean().optional(),
  finding: z.object({ status: z.string(), evidence: z.string().max(4000) }).passthrough().optional(),
  reason: z.string().max(4000).optional(), retry_after_ms: z.number().nonnegative().optional(), queue: z.unknown().optional(), guidance: z.unknown().optional(),
}).passthrough();
type Outcome = { kind: 'committed'; state: LabExecutionState } | { kind: 'waiting'; retryAfterMs: number; analysisStatus: string };
// Zod orders known fields before passthrough fields. JSON property order has no
// authority over a decision; array order still does.
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export function startAnalysisStream(response: Response, options: { frame: FrameReceipt; context: ExecutionContext; signal: AbortSignal; onPreview(text: string): void; onCommit(state: LabExecutionState): void }) {
  let resolveCore!: (value: Outcome) => void, rejectCore!: (error: unknown) => void, coreDone = false;
  const committed = new Promise<Outcome>((resolve, reject) => { resolveCore = resolve; rejectCore = reject; });
  const completion = (async () => {
    if (!response.ok || !response.headers.get('Content-Type')?.includes('text/event-stream') || !response.body) throw new ServiceError('The screen reader did not return a supported stream.');
    const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
    let pending = '', lines: string[] = [], requestId: string | null = null, last = 0, admittedRevision: number | null = null, terminal = false, admitted = false, total = 0;
    try {
      while (true) {
        if (options.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const { value, done } = await reader.read(); if (done) break;
        total += value.length; if (total > 4_000_000) throw new Error('Analysis stream exceeded its limit.');
        pending += decoder.decode(value, { stream: true });
        while (pending.includes('\n')) {
          const index = pending.indexOf('\n'), line = pending.slice(0, index).replace(/\r$/, ''); pending = pending.slice(index + 1);
          if (line.startsWith('data:')) lines.push(line.slice(5).replace(/^ /, ''));
          if (line || !lines.length) continue;
          const event = EventSchema.parse(JSON.parse(lines.join('\n'))); lines = [];
          if (terminal) throw new Error('Analysis event after completion.');
          requestId ??= event.request_id;
          if (requestId !== event.request_id || event.event_sequence !== last + 1) throw new Error('Foreign or out-of-order analysis event.');
          last = event.event_sequence;
          if (event.type === 'admitted') {
            if (admitted || !event.frame || ['frame_id', 'sha256', 'width', 'height', 'byte_count', 'view_revision'].some(k => event.frame![k] !== options.frame[k])) throw new Error('Analysis frame changed.');
            if (!event.context || Object.entries(options.context).some(([k, v]) => event.context![k as keyof ExecutionContext] !== v)) throw new Error('Analysis context changed.');
            admitted = true; admittedRevision = event.context.lab_revision ?? null;
          } else if (['provisional_findings', 'critical_fields_ready', 'guidance_committed', 'state_snapshot'].includes(event.type) && !admitted) throw new Error('Finding arrived before admission.');
          if (event.type === 'provisional_findings' && event.finding && !coreDone) options.onPreview(event.finding.evidence.slice(0, 600));
          if (event.type === 'guidance_committed') {
            const state = event.state, context = event.current_context;
            if (coreDone || event.provisional !== false || !state || !context || state.projection !== 'committed-decision/v1' || state.revision !== event.revision
              || state.lab_session_id !== options.context.lab_session_id || context.lab_session_id !== state.lab_session_id || context.lab_revision !== state.revision
              || (admittedRevision !== null && state.revision <= admittedRevision) || state.runtime.last_analysis_timing?.frame_id !== options.frame.frame_id
              || canonical(state.queue) !== canonical(event.queue) || canonical(state.guidance) !== canonical(event.guidance)) throw new Error('Invalid committed decision.');
            if (state.queue.current_checkpoint_id !== context.checkpoint_id || ['workspace_id', 'capture_epoch', 'view_revision', 'parameter_revision', 'condition'].some(k => context[k as keyof ExecutionContext] !== options.context[k as keyof ExecutionContext])
              || state.workspace.id !== context.workspace_id || state.workspace.capture_epoch !== context.capture_epoch || state.workspace.view_revision !== context.view_revision) throw new Error('Committed context changed.');
            coreDone = true; options.onCommit(state); resolveCore({ kind: 'committed', state });
          }
          if (event.type === 'analysis_waiting' && !coreDone) {
            coreDone = true; resolveCore({ kind: 'waiting', analysisStatus: event.state?.runtime.analysis_status ?? 'waiting_for_provider', retryAfterMs: Math.max(2000, event.retry_after_ms ?? event.state?.runtime.retry_after_ms ?? 12000) });
          }
          if (event.type === 'analysis_failed' || event.type === 'discarded') throw new ServiceError(event.reason ?? 'This screen read is no longer current.');
          if (event.type === 'stream_complete') terminal = true;
        }
      }
      pending += decoder.decode();
      if (pending.trim() || lines.length || !terminal || !coreDone) throw new Error('Analysis stream ended before completion.');
    } finally { await reader.cancel().catch(() => undefined); }
  })().catch(error => { if (!coreDone) rejectCore(error); throw error; });
  completion.catch(() => undefined); committed.catch(() => undefined);
  return { committed, completion };
}
