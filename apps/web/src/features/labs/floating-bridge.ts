/** Reader bridge for the unchanged floating-guidance/v0.1 extension protocol. */
import { FG_LIMITS, FG_SCHEMA, contentKey, projectSnapshot, type ProjectionInput } from './floating-guidance';

type Rect = { x: number; y: number; w: number; h: number };
export type CaptureTrack = MediaStreamTrack & { getCaptureHandle?: () => { handle?: string; origin?: string } | null };
export type SampleSafety = { mode: 'block'; reason: string } | { mode: 'redact'; boxes: Rect[] };
type Binding = { handle: string; target_origin: string };
const CHANNEL = 'kiki-floating-guidance';
// Responses are broadcast to this document. IDs must survive controller remounts:
// an old hello reply must not resolve a new controller's first hello.
let nextBridgeId = 0;
let currentPublisher: symbol | null = null;
export function createFloatingPublisher({ onCommand, onChange = () => {}, targetOrigins = ['https://matlab.mathworks.com'] }: { onCommand(command: 'pause' | 'resume'): Promise<void>; onChange?(): void; targetOrigins?: readonly string[] }) {
  const ownership = Symbol(); currentPublisher = ownership;
  const streamId = crypto.randomUUID();
  let present = false, generation: number | null = null, binding: Binding | null = null, superseded = false, disposed = false;
  let sequence = 0, lastKey: string | null = null, lastSentAt = 0, source: () => ProjectionInput | null = () => null;
  let helloPending = false;
  let ownershipEpoch = 0, bindingEpoch = 0;
  let reports: { at: number; rects: Rect[] }[] = [], viewport: { w: number; h: number } | null = null, moving = false;
  let safety: SampleSafety = { mode: 'block', reason: 'Show Kiki on your MATLAB tab before sharing.' };
  const waiting = new Map<number, { resolve(value: Record<string, unknown>): void; timer: number }>();
  const post = (message: Record<string, unknown>) => new Promise<Record<string, unknown>>(resolve => {
    if (disposed) { resolve({ ok: false }); return; }
    const bridge_id = ++nextBridgeId;
    const timer = window.setTimeout(() => { waiting.delete(bridge_id); resolve({ ok: false, error: 'bridge_timeout' }); }, 5000);
    waiting.set(bridge_id, { resolve, timer });
    window.postMessage({ channel: CHANNEL, direction: 'page', bridge_id, ...message }, location.origin);
  });
  async function hello() {
    if (disposed || currentPublisher !== ownership || helloPending) return;
    helloPending = true;
    const epoch = ownershipEpoch, targetEpoch = bindingEpoch;
    const result = await post({ type: 'reader_hello', stream_id: streamId, lab_session_id: source()?.state.lab_session_id ?? null });
    helloPending = false;
    if (disposed || epoch !== ownershipEpoch || !result.ok || !Number.isSafeInteger(result.generation)) return;
    present = true; generation = result.generation as number; superseded = false;
    const candidate = result.binding as Binding | null;
    if (targetEpoch === bindingEpoch) binding = candidate && targetOrigins.includes(candidate.target_origin) ? candidate : null;
    reports = []; viewport = null; lastKey = null; onChange(); void flush(true);
  }
  async function flush(force = false) {
    if (disposed || currentPublisher !== ownership || !present || generation === null || !binding || superseded) return;
    const input = source(); if (!input) return;
    const body = projectSnapshot(input.state, { ...input, blockedReason: safety.mode === 'block' ? safety.reason : null });
    const key = contentKey(body), now = performance.now();
    if (!force && key === lastKey && now - lastSentAt < 5000) return;
    const message = { schema: FG_SCHEMA, type: 'replace_snapshot', stream_id: streamId, generation, sequence: ++sequence, issued_at: new Date().toISOString(), body };
    if (JSON.stringify(message).length > FG_LIMITS.message_chars) return;
    lastKey = key; lastSentAt = now;
    const result = await post({ type: 'reader_snapshot', message });
    if (disposed || generation !== message.generation) return;
    if (!result.ok) {
      lastKey = null;
      if (['stale_stream_or_generation', 'not_current_controller'].includes(String(result.error))) {
        // Fail closed; explicit re-check may reclaim control. Never relax stale rejection.
        superseded = true; generation = null; binding = null; reports = []; viewport = null; onChange();
      }
    }
  }
  async function command(message: Record<string, unknown>) {
    if (disposed || superseded || currentPublisher !== ownership || generation === null || !['pause', 'resume'].includes(String(message.command))) return;
    const commandGeneration = generation;
    let ok = true;
    try { await onCommand(message.command as 'pause' | 'resume'); } catch { ok = false; }
    if (disposed || superseded || currentPublisher !== ownership || generation !== commandGeneration) return;
    await post({ type: 'reader_command_result', stream_id: streamId, generation: commandGeneration, request_id: message.request_id, ok, error: ok ? null : 'Use the controls in Lab mode to reconnect.' });
    void flush(true);
  }
  const receive = (event: MessageEvent) => {
    const m = event.data;
    if (disposed || currentPublisher !== ownership || event.source !== window || event.origin !== location.origin || !m || m.channel !== CHANNEL || m.direction !== 'extension') return;
    // 0.1.1 supplies response identity. Older protocol events omit it; when
    // present it must belong to this publisher, including hello replies.
    if (m.stream_id !== undefined && m.stream_id !== streamId) return;
    if (m.type === 'response') { const item = waiting.get(m.bridge_id); if (item) { clearTimeout(item.timer); waiting.delete(m.bridge_id); item.resolve(m.result ?? {}); } return; }
    if (m.type === 'extension_present') { if (!present) void hello(); return; }
    if (m.type === 'fg_target_bound') {
      ++bindingEpoch;
      binding = typeof m.handle === 'string' && m.handle.length <= 256 && targetOrigins.includes(m.target_origin) ? { handle: m.handle, target_origin: m.target_origin } : null;
      reports = []; viewport = null; onChange(); void flush(true);
    } else if (m.type === 'fg_target_closed') { ++bindingEpoch; binding = null; reports = []; viewport = null; onChange(); }
    else if (m.type === 'fg_superseded') { ++ownershipEpoch; superseded = true; generation = null; binding = null; onChange(); }
    else if (m.type === 'fg_snapshot_request') void flush(true);
    else if (m.type === 'fg_command') void command(m);
    else if (m.type === 'fg_rects') {
      const at = performance.now();
      if (!m.viewport || ![m.viewport.w, m.viewport.h].every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0)) return;
      if (!Array.isArray(m.rects) || m.rects.length > 4 || !m.rects.every((r: Rect) => r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w >= 0 && r.h >= 0)) return;
      reports = [...reports.filter(r => at - r.at <= 1500), { at, rects: m.rects }]; viewport = m.viewport; moving = Boolean(m.moving);
    }
  };
  window.addEventListener('message', receive);
  const heartbeat = window.setInterval(() => { void flush(); }, 1000);
  // React's lazy route may mount after the extension's load announcement.
  void hello();
  const publisher = {
    source(fn: () => ProjectionInput | null) { source = fn; },
    changed() { void flush(); }, recheck() { void hello(); },
    status: () => ({ present, bound: Boolean(binding), superseded }),
    matchesTarget(track: CaptureTrack) {
      const handle = track.getCaptureHandle?.();
      return Boolean(present && binding && !superseded && track.getSettings().displaySurface === 'browser' && handle?.handle === binding.handle && handle?.origin === binding.target_origin);
    },
    sampleSafety(track: CaptureTrack, width: number, height: number): SampleSafety {
      const block = (reason: string): SampleSafety => safety = { mode: 'block', reason };
      const settings = track.getSettings(), handle = track.getCaptureHandle?.();
      if (!present || !binding || superseded) return block('Show Kiki on your MATLAB tab before sharing.');
      if (settings.displaySurface !== 'browser' || handle?.handle !== binding.handle || handle.origin !== binding.target_origin) return block('Share the same Chrome tab where Kiki is shown.');
      if (!viewport || !reports.length || performance.now() - reports[reports.length - 1].at > 4000) return block('Waiting for fresh Kiki window positions before reading the screen.');
      if (moving) return block('A Kiki window is moving; the next frame will be read.');
      const sx = width / viewport.w, sy = height / viewport.h;
      if (!(sx > 0 && sy > 0) || Math.abs(sx - sy) / sx > 0.04) return block('The shared tab size changed. Share your MATLAB tab again.');
      const now = performance.now();
      const boxes = reports.filter((r, i) => i === reports.length - 1 || now - r.at <= 1500).flatMap(r => r.rects).map(r => ({ x: (r.x - 16) * sx, y: (r.y - 16) * sy, w: (r.w + 32) * sx, h: (r.h + 32) * sy }));
      return safety = { mode: 'redact', boxes };
    },
    apply(context: CanvasRenderingContext2D, decision: SampleSafety, width: number, height: number) {
      context.save(); context.fillStyle = '#7f7f7f';
      if (decision.mode === 'block') context.fillRect(0, 0, width, height);
      else for (const box of decision.boxes) context.fillRect(box.x, box.y, box.w, box.h);
      context.restore();
    },
    blockedReason: () => safety.mode === 'block' ? safety.reason : null,
    dispose() {
      if (disposed) return;
      // A pending hello can already have registered upstream even before its reply.
      // Identity scopes 0.1.1 controls; ownership also protects legacy tab-scoped bye.
      if (currentPublisher === ownership) {
        if ((present && generation !== null) || helloPending) window.postMessage({ channel: CHANNEL, direction: 'page', bridge_id: 0, type: 'reader_bye', stream_id: streamId, ...(generation !== null ? { generation } : {}) }, location.origin);
        currentPublisher = null;
      }
      disposed = true; clearInterval(heartbeat); window.removeEventListener('message', receive);
      for (const item of waiting.values()) { clearTimeout(item.timer); item.resolve({ ok: false }); } waiting.clear();
    },
  };
  return publisher;
}
export type FloatingPublisher = ReturnType<typeof createFloatingPublisher>;
