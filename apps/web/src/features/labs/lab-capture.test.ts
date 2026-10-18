// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { AuthService } from '../../contracts/services';
import type { LabExecutionApi } from '../../contracts/lab-execution';
import { LabExecutionStateSchema } from '../../contracts/lab-execution';
import receipt from './__fixtures__/python-execution.json';
const mocks = vi.hoisted(() => ({ safety: { mode: 'redact', boxes: [] } as { mode: 'block' | 'redact'; boxes?: unknown[]; reason?: string }, dispose: vi.fn(), apply: vi.fn() }));
vi.mock('./floating-bridge', () => ({ createFloatingPublisher: () => ({ source: vi.fn(), changed: vi.fn(), recheck: vi.fn(), matchesTarget: () => true, blockedReason: () => null, status: () => ({ present: true, bound: true, superseded: false }), sampleSafety: () => mocks.safety, apply: mocks.apply, dispose: mocks.dispose }) }));
import { LabCaptureController } from './lab-capture';
let cleanup: () => unknown, connection: LabCaptureController;
const track = () => Object.assign(new EventTarget(), { stop: vi.fn(), getSettings: () => ({ displaySurface: 'browser' }), getCaptureHandle: () => ({ handle: 'bound', origin: 'https://matlab.mathworks.com' }) });
function setup() {
  const state = LabExecutionStateSchema.parse(receipt.start), video = track();
  const stream = { getTracks: () => [video], getVideoTracks: () => [video] } as unknown as MediaStream;
  const media = vi.fn(async () => stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: media } });
  const channel = { ready: Promise.resolve(), close: vi.fn(), command: vi.fn(async () => {}), sendFrame: vi.fn(async () => receipt.frame) };
  const api = { get: vi.fn(async () => state), start: vi.fn(async () => state), attach: vi.fn(async () => state), screen: vi.fn(async () => ({ session_id: 'screen' })), channel: vi.fn(async () => channel), check: vi.fn(async () => { throw new Error('Controlled provider wait'); }), context: vi.fn(async () => state) };
  const auth = { registerSignOutCleanup: (fn: () => unknown) => { cleanup = fn; return () => {}; } } as AuthService;
  connection = new LabCaptureController('prep-test', api as unknown as LabExecutionApi, auth);
  return { state, video, stream, media, channel, api };
}
beforeEach(() => {
  mocks.safety = { mode: 'redact', boxes: [] }; mocks.apply.mockReset(); mocks.dispose.mockReset();
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1280); vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(800);
});
afterEach(() => { connection.dispose(); vi.restoreAllMocks(); });
it('reload offers reconnect without opening a picker; saved state cannot imply live capture', async () => {
  const { media } = setup(); await connection.load();
  expect(connection.view().phase).toBe('disconnected'); expect(media).not.toHaveBeenCalled();
  expect(connection.view().snapshot?.runtime.capture_active).toBe(false);
});
it('a cancelled pending picker is stopped and cannot create an execution after navigation', async () => {
  const { media, stream, video, api } = setup();
  let resolve!: (s: MediaStream) => void; media.mockReturnValue(new Promise(r => resolve = r));
  const pending = connection.share(); connection.stop(); resolve(stream); await pending;
  expect(video.stop).toHaveBeenCalled(); expect(api.start).not.toHaveBeenCalled();
});
it('wrong-tab capture ends before execution or frame encoding', async () => {
  const { video, api } = setup(); mocks.safety = { mode: 'block', reason: 'Share the same Chrome tab where Kiki is shown.' };
  await connection.share(); expect(video.stop).toHaveBeenCalled(); expect(api.start).not.toHaveBeenCalled();
  expect(connection.view().phase).toBe('disconnected');
});
it('masks before encoding and sending, then sign-out synchronously stops all resources', async () => {
  const { api, channel, video } = setup();
  const order: string[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => order.push('draw') } as unknown as CanvasRenderingContext2D);
  mocks.apply.mockImplementation(() => order.push('mask'));
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => { order.push('encode'); callback(new Blob(['jpg'])); });
  channel.sendFrame.mockImplementation(async () => { order.push('send'); return receipt.frame; });
  await connection.share(); await vi.waitFor(() => expect(channel.sendFrame).toHaveBeenCalled());
  expect(order.slice(0, 4)).toEqual(['draw', 'mask', 'encode', 'send']); expect(api.start).toHaveBeenCalledTimes(1);
  cleanup(); expect(video.stop).toHaveBeenCalled(); expect(channel.close).toHaveBeenCalled(); expect(mocks.dispose).toHaveBeenCalled();
  expect(connection.view().snapshot?.runtime.capture_active).toBe(false);
});
it('missing/moving window positions never encode or send an unsafe frame', async () => {
  const { channel } = setup(); mocks.safety = { mode: 'block', reason: 'Waiting for fresh Kiki window positions.' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob'); await connection.share();
  await vi.waitFor(() => expect(mocks.apply).toHaveBeenCalled()); expect(encode).not.toHaveBeenCalled(); expect(channel.sendFrame).not.toHaveBeenCalled();
});
it('late events and disconnect callbacks from an old capture cannot stop a fresh gesture', async () => {
  const { media, video, api } = setup();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpg'])));
  await connection.share(); connection.stop();
  const nextTrack = track(), stream = { getTracks: () => [nextTrack], getVideoTracks: () => [nextTrack] } as unknown as MediaStream;
  media.mockResolvedValueOnce(stream); await connection.share();
  video.dispatchEvent(new Event('ended')); video.dispatchEvent(new Event('capturehandlechange'));
  const callback = (api.channel.mock.calls as unknown as [string, string, () => void][])[0][2]; callback();
  expect(nextTrack.stop).not.toHaveBeenCalled(); expect(connection.view().phase).toBe('active');
});
it('Stop during an in-flight pause cannot reactivate the panel or capture later', async () => {
  const { api, state } = setup();
  mocks.safety = { mode: 'block', reason: 'Waiting for positions.' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  await connection.share();
  let resolve!: (s: typeof state) => void; api.context.mockReturnValue(new Promise(r => resolve = r));
  const pending = connection.command('pause'); await vi.waitFor(() => expect(api.context).toHaveBeenCalled());
  connection.stop(); resolve({ ...state, status: 'paused' }); await pending;
  expect(connection.view().phase).toBe('disconnected'); expect(connection.view().snapshot?.runtime.capture_active).toBe(false);
});
it('completed saved runs show completion without opening a picker', async () => {
  const { api, state, media } = setup(); api.get.mockResolvedValue({ ...state, status: 'completed' });
  await connection.load(); expect(connection.view().phase).toBe('completed'); expect(media).not.toHaveBeenCalled();
});
