// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { AuthService } from '../../contracts/services';
import { LabExecutionStateSchema, type LabExecutionApi } from '../../contracts/lab-execution';
import receipt from './__fixtures__/python-execution.json';
import requirements from './__fixtures__/lab-input-requirements.json';
import { currentScope } from './floating-guidance';
vi.mock('./floating-bridge', () => ({ createFloatingPublisher: () => ({ source: vi.fn(), changed: vi.fn(), recheck: vi.fn(), matchesTarget: () => true, sampleSafety: () => ({ mode: 'redact', boxes: [] }), blockedReason: () => null, status: () => ({ present: true, bound: true, superseded: false }), dispose: vi.fn() }) }));
import { LabCaptureController } from './lab-capture';
let controller: LabCaptureController;
afterEach(() => { controller?.dispose(); vi.restoreAllMocks(); });
async function setup() {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(0);
  const track = Object.assign(new EventTarget(), { stop: vi.fn(), getSettings: () => ({ displaySurface: 'browser' }) });
  const media = vi.fn(async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: media } });
  const committed = receipt.events.find(e => e.type === 'guidance_committed')!.state!;
  const state = LabExecutionStateSchema.parse({ ...receipt.start, ...committed, definition: receipt.start.definition });
  const api = { get: vi.fn(async () => state), requirements: vi.fn(async () => requirements), attach: vi.fn(async () => state), screen: vi.fn(async () => ({ session_id: 'screen' })), channel: vi.fn(async () => ({ ready: Promise.resolve(), close: vi.fn(), command: vi.fn(async () => {}) })), review: vi.fn(async () => state) };
  let signOut!: () => unknown;
  const auth = { registerSignOutCleanup: (fn: () => unknown) => { signOut = fn; return () => {}; } } as AuthService;
  controller = new LabCaptureController('prep-confirmation-boundary', api as unknown as LabExecutionApi, auth);
  await controller.load(); await Promise.resolve(); await controller.share();
  return { api, state, signOut, media, track };
}
it('advances only after the authoritative confirmation reply and suppresses duplicate review requests', async () => {
  const { api, state } = await setup();
  let finish!: (value: typeof state) => void;
  api.review.mockReturnValue(new Promise(resolve => finish = resolve));
  const scope = JSON.stringify(currentScope(state));
  const input = { criterion_ids: ['CP-DSB-01:project_ref'], review_note: 'Synthetic test note only, no learner submission.' };
  const pending = controller.submitInput(scope, input);
  await expect(controller.submitInput(scope, input)).rejects.toThrow('Wait');
  expect(controller.view().state!.queue.current_checkpoint_id).toBe(state.queue.current_checkpoint_id);
  expect(api.review).toHaveBeenCalledTimes(1);
  finish({ ...state, revision: state.revision + 1, queue: { ...state.queue, current_checkpoint_id: 'CP-DSB-02', done_checkpoint_ids: ['CP-DSB-01'] } });
  await pending;
  expect(controller.view().state!.queue.current_checkpoint_id).toBe('CP-DSB-02');
});
it.each(['Stop', 'sign-out', 'dispose'] as const)('rejects a late accepted confirmation after %s without adopting its progress or restarting capture', async ending => {
  const { api, state, signOut, media, track } = await setup();
  let finish!: (value: typeof state) => void;
  api.review.mockReturnValue(new Promise(resolve => finish = resolve));
  const pending = controller.submitInput(JSON.stringify(currentScope(state)), { criterion_ids: ['CP-DSB-01:project_ref'], review_note: 'Synthetic interrupted review, test boundary only.' });
  const interrupted = expect(pending).rejects.toThrow('interrupted');
  if (ending === 'Stop') controller.stop(); else if (ending === 'sign-out') signOut(); else controller.dispose();
  const signal = (api.review.mock.calls as unknown as [string, object, AbortSignal][])[0][2];
  expect(signal.aborted).toBe(true);
  finish({ ...state, revision: state.revision + 100, queue: { ...state.queue, current_checkpoint_id: 'CP-DSB-02' } });
  await interrupted;
  expect(controller.view().state!.revision).toBe(state.revision);
  expect(controller.view().state!.queue.current_checkpoint_id).toBe(state.queue.current_checkpoint_id);
  expect(controller.view().phase).toBe('disconnected');
  expect(track.stop).toHaveBeenCalled(); expect(media).toHaveBeenCalledTimes(1);
});
