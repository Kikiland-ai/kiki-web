// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { createFloatingPublisher, type CaptureTrack } from './floating-bridge';
import receipt from './__fixtures__/python-execution.json';
import { LabExecutionStateSchema } from '../../contracts/lab-execution';
const message = (value: object, origin = location.origin, source: MessageEventSource = window) => window.dispatchEvent(new MessageEvent('message', { origin, source, data: { channel: 'kiki-floating-guidance', direction: 'extension', ...value } }));
const track = (handle = 'bound', origin = 'https://matlab.mathworks.com', surface = 'browser') => ({ getSettings: () => ({ displaySurface: surface }), getCaptureHandle: () => ({ handle, origin }) }) as CaptureTrack;
const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).forEach(fn => fn()); vi.restoreAllMocks(); vi.useRealTimers(); });
async function setup() {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {}), command = vi.fn(async () => {});
  const publisher = createFloatingPublisher({ onCommand: command }); disposers.push(() => publisher.dispose());
  publisher.source(() => ({ state: LabExecutionStateSchema.parse(receipt.start) }));
  const hello = post.mock.calls[0][0];
  message({ type: 'response', bridge_id: hello.bridge_id, result: { ok: true, generation: 2, binding: { handle: 'bound', target_origin: 'https://matlab.mathworks.com' } } });
  await Promise.resolve(); await Promise.resolve();
  return { publisher, post, command };
}
it('fails closed without a binding and ignores foreign-window/origin messages', () => {
  const publisher = createFloatingPublisher({ onCommand: async () => {} }); disposers.push(() => publisher.dispose());
  message({ type: 'fg_target_bound', handle: 'bound', target_origin: 'https://matlab.mathworks.com' }, 'https://foreign.example');
  expect(publisher.status().bound).toBe(false); expect(publisher.sampleSafety(track(), 1280, 800).mode).toBe('block');
});
it('requires exact tab handle, origin, browser surface, fresh positions and stable layout', async () => {
  const { publisher } = await setup();
  const report = { type: 'fg_rects', viewport: { w: 1280, h: 800 }, rects: [{ x: 100, y: 100, w: 100, h: 80 }], moving: false };
  expect(publisher.sampleSafety(track(), 1280, 800).mode).toBe('block'); message(report);
  expect(publisher.sampleSafety(track('wrong'), 1280, 800).mode).toBe('block');
  expect(publisher.sampleSafety(track('bound', 'https://foreign.example'), 1280, 800).mode).toBe('block');
  expect(publisher.sampleSafety(track('bound', 'https://matlab.mathworks.com', 'monitor'), 1280, 800).mode).toBe('block');
  expect(publisher.sampleSafety(track(), 1280, 600).mode).toBe('block');
  message({ ...report, moving: true }); expect(publisher.sampleSafety(track(), 1280, 800).mode).toBe('block');
  message(report); const safe = publisher.sampleSafety(track(), 1280, 800); expect(safe.mode).toBe('redact'); expect(safe.mode === 'redact' && safe.boxes[0]).toEqual({ x: 84, y: 84, w: 132, h: 112 });
  vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 5000);
  expect(publisher.sampleSafety(track(), 1280, 800).mode).toBe('block');
});
it('masks the recent rectangle union, applies neutral pixels and disposes listeners', async () => {
  const { publisher, command } = await setup();
  message({ type: 'fg_rects', viewport: { w: 1280, h: 800 }, rects: [{ x: 10, y: 20, w: 100, h: 80 }], moving: false });
  message({ type: 'fg_rects', viewport: { w: 1280, h: 800 }, rects: [{ x: 300, y: 20, w: 100, h: 80 }], moving: false });
  const safety = publisher.sampleSafety(track(), 640, 400); expect(safety.mode === 'redact' && safety.boxes).toHaveLength(2);
  const canvas = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), fillStyle: '' }; publisher.apply(canvas as unknown as CanvasRenderingContext2D, safety, 640, 400);
  expect(canvas.fillRect).toHaveBeenCalledTimes(2); expect(canvas.fillStyle).toBe('#7f7f7f');
  publisher.dispose(); message({ type: 'fg_command', command: 'pause' }); expect(command).not.toHaveBeenCalled();
});
it('publishes ordered unchanged-protocol snapshots on content changes and five-second heartbeat', async () => {
  vi.useFakeTimers(); const { publisher, post } = await setup();
  const snapshots = () => post.mock.calls.map(c => c[0]).filter(m => m.type === 'reader_snapshot');
  const before = snapshots().length; publisher.changed(); expect(snapshots()).toHaveLength(before);
  await vi.advanceTimersByTimeAsync(5001); expect(snapshots().length).toBeGreaterThan(before);
  const last = snapshots().at(-1).message; expect(last).toMatchObject({ schema: 'floating-guidance/v0.1', generation: 2 });
  expect(last.sequence).toBeGreaterThan(1);
  message({ type: 'fg_command', command: 'pause', request_id: 'request' }); await Promise.resolve();
});
it('a late hello from an unmounted controller cannot bind its replacement to the old generation', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  const old = createFloatingPublisher({ onCommand: async () => {} });
  const oldHello = post.mock.calls[0][0]; old.dispose();
  const current = createFloatingPublisher({ onCommand: async () => {} }); disposers.push(() => current.dispose());
  current.source(() => ({ state: LabExecutionStateSchema.parse(receipt.start) }));
  const newHello = post.mock.calls.map(c => c[0]).filter(m => m.type === 'reader_hello').at(-1);
  expect(newHello.bridge_id).not.toBe(oldHello.bridge_id);
  message({ type: 'response', bridge_id: oldHello.bridge_id, result: { ok: true, generation: 3, binding: { handle: 'old', target_origin: 'https://matlab.mathworks.com' } } });
  await Promise.resolve(); expect(current.status().present).toBe(false);
  message({ type: 'response', bridge_id: newHello.bridge_id, result: { ok: true, generation: 4, binding: { handle: 'bound', target_origin: 'https://matlab.mathworks.com' } } });
  await Promise.resolve(); await Promise.resolve();
  expect(current.matchesTarget(track())).toBe(true);
  const snapshot = post.mock.calls.map(c => c[0]).filter(m => m.type === 'reader_snapshot').at(-1);
  expect(snapshot.message).toMatchObject({ generation: 4, stream_id: newHello.stream_id });
});
it('coalesces startup announcements and double re-checks until hello completes', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  const publisher = createFloatingPublisher({ onCommand: async () => {} }); disposers.push(() => publisher.dispose());
  publisher.recheck(); publisher.recheck(); message({ type: 'extension_present' });
  expect(post.mock.calls.filter(c => c[0].type === 'reader_hello')).toHaveLength(1);
  const first = post.mock.calls[0][0];
  message({ type: 'response', bridge_id: first.bridge_id, result: { ok: true, generation: 5, binding: null } }); await Promise.resolve();
  publisher.recheck(); publisher.recheck();
  expect(post.mock.calls.filter(c => c[0].type === 'reader_hello')).toHaveLength(2);
});
it('a superseded or closed-target event cannot be undone by a late hello response', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  const publisher = createFloatingPublisher({ onCommand: async () => {} }); disposers.push(() => publisher.dispose());
  const old = post.mock.calls[0][0]; message({ type: 'fg_superseded' });
  message({ type: 'response', bridge_id: old.bridge_id, result: { ok: true, generation: 8, binding: { handle: 'bound', target_origin: 'https://matlab.mathworks.com' } } });
  await Promise.resolve(); expect(publisher.status()).toMatchObject({ superseded: true, bound: false });
  publisher.recheck(); const hello = post.mock.calls.map(c => c[0]).filter(m => m.type === 'reader_hello').at(-1);
  message({ type: 'fg_target_closed' });
  message({ type: 'response', bridge_id: hello.bridge_id, result: { ok: true, generation: 9, binding: { handle: 'bound', target_origin: 'https://matlab.mathworks.com' } } });
  await Promise.resolve(); expect(publisher.status()).toMatchObject({ superseded: false, bound: false });
});
it('closes a pending hello on dispose without letting an old instance close its replacement', () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  const old = createFloatingPublisher({ onCommand: async () => {} });
  const replacement = createFloatingPublisher({ onCommand: async () => {} });
  old.dispose(); expect(post.mock.calls.filter(c => c[0].type === 'reader_bye')).toHaveLength(0);
  replacement.dispose(); expect(post.mock.calls.filter(c => c[0].type === 'reader_bye')).toHaveLength(1);
});
it('rejects stale ownership and ignores a rejection belonging to an earlier hello generation', async () => {
  const { publisher, post } = await setup();
  const snapshot = post.mock.calls.map(c => c[0]).filter(m => m.type === 'reader_snapshot').at(-1);
  publisher.recheck();
  const hello = post.mock.calls.map(c => c[0]).filter(m => m.type === 'reader_hello').at(-1);
  message({ type: 'response', bridge_id: hello.bridge_id, result: { ok: true, generation: 3, binding: { handle: 'bound', target_origin: 'https://matlab.mathworks.com' } } });
  await Promise.resolve(); await Promise.resolve();
  message({ type: 'response', bridge_id: snapshot.bridge_id, result: { ok: false, error: 'stale_stream_or_generation' } }); await Promise.resolve();
  expect(publisher.status().superseded).toBe(false);
  const latest = post.mock.calls.map(c => c[0]).filter(m => m.type === 'reader_snapshot').at(-1);
  message({ type: 'response', bridge_id: latest.bridge_id, result: { ok: false, error: 'stale_stream_or_generation' } }); await Promise.resolve();
  expect(publisher.status()).toMatchObject({ superseded: true, bound: false });
  const count = post.mock.calls.length; publisher.changed(); expect(post.mock.calls).toHaveLength(count);
});
it('filters identity-bearing replies and includes stream/generation on command results and bye', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {}), command = vi.fn(async () => {});
  const publisher = createFloatingPublisher({ onCommand: command }); disposers.push(() => publisher.dispose());
  const hello = post.mock.calls.at(-1)![0];
  const result = { ok: true, generation: 7, binding: null };
  message({ type: 'response', bridge_id: hello.bridge_id, stream_id: 'another-publisher', result });
  await Promise.resolve(); expect(publisher.status().present).toBe(false);
  message({ type: 'response', bridge_id: hello.bridge_id, stream_id: hello.stream_id, result });
  await Promise.resolve();
  message({ type: 'fg_command', command: 'pause', request_id: 'req' });
  await Promise.resolve();
  expect(command).toHaveBeenCalledTimes(1);
  expect(post.mock.calls.map(c => c[0]).find(m => m.type === 'reader_command_result')).toMatchObject({ stream_id: hello.stream_id, generation: 7, request_id: 'req', ok: true });
  publisher.dispose();
  expect(post.mock.calls.at(-1)![0]).toMatchObject({ type: 'reader_bye', stream_id: hello.stream_id, generation: 7 });
});
it('ignores commands while superseded and never acknowledges a late command for its replacement', async () => {
  const { publisher, post, command } = await setup();
  let finish!: () => void; command.mockImplementationOnce(() => new Promise<void>(r => finish = r));
  message({ type: 'fg_command', command: 'pause', request_id: 'old' });
  message({ type: 'fg_superseded' });
  message({ type: 'fg_command', command: 'resume', request_id: 'stale' });
  finish(); await Promise.resolve();
  expect(command).toHaveBeenCalledTimes(1);
  expect(post.mock.calls.filter(c => c[0].type === 'reader_command_result')).toHaveLength(0);
  expect(publisher.status().superseded).toBe(true);
});
it('an overlapping old publisher cannot recheck or publish after its replacement owns the document', async () => {
  const { publisher: old, post, command } = await setup();
  const replacement = createFloatingPublisher({ onCommand: async () => {} }); disposers.push(() => replacement.dispose());
  const count = post.mock.calls.length;
  old.recheck(); old.changed();
  message({ type: 'fg_command', command: 'pause' });
  expect(post.mock.calls).toHaveLength(count); expect(command).not.toHaveBeenCalled();
});
