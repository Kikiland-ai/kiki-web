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
