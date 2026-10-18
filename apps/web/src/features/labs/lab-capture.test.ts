// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { AuthService } from '../../contracts/services';
import type { LabExecutionApi } from '../../contracts/lab-execution';
import { LabExecutionStateSchema } from '../../contracts/lab-execution';
import receipt from './__fixtures__/python-execution.json';
import requirements from './__fixtures__/lab-input-requirements.json';
const mocks = vi.hoisted(() => ({ safety: { mode: 'redact', boxes: [] } as { mode: 'block' | 'redact'; boxes?: unknown[]; reason?: string }, dispose: vi.fn(), apply: vi.fn() }));
vi.mock('./floating-bridge', () => ({ createFloatingPublisher: () => ({ source: vi.fn(), changed: vi.fn(), recheck: vi.fn(), matchesTarget: () => true, blockedReason: () => null, status: () => ({ present: true, bound: true, superseded: false }), sampleSafety: () => mocks.safety, apply: mocks.apply, dispose: mocks.dispose }) }));
import { LabCaptureController } from './lab-capture';
import { ServiceError } from '../../services/types';
import { currentScope } from './floating-guidance';
let cleanup: () => unknown, connection: LabCaptureController;
const track = () => Object.assign(new EventTarget(), { stop: vi.fn(), getSettings: () => ({ displaySurface: 'browser' }), getCaptureHandle: () => ({ handle: 'bound', origin: 'https://matlab.mathworks.com' }) });
function setup() {
  const state = LabExecutionStateSchema.parse(receipt.start), video = track();
  const stream = { getTracks: () => [video], getVideoTracks: () => [video] } as unknown as MediaStream;
  const media = vi.fn(async () => stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: media } });
  const channel = { ready: Promise.resolve(), close: vi.fn(), command: vi.fn(async () => {}), sendFrame: vi.fn(async () => receipt.frame) };
  const api = { get: vi.fn(async () => state), start: vi.fn(async () => state), recover: vi.fn(async () => state), requirements: vi.fn(async () => requirements), review: vi.fn(async () => ({ ...state, revision: state.revision + 1 })), respond: vi.fn(async () => ({ ...state, revision: state.revision + 1 })), attach: vi.fn(async () => state), screen: vi.fn(async () => ({ session_id: 'screen' })), channel: vi.fn(async () => channel), check: vi.fn(async () => { throw new Error('Controlled provider wait'); }), context: vi.fn(async () => state) };
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
it('serializes Resume behind the final Pause read using the latest committed revision', async () => {
  const { api, state, channel } = setup();
  mocks.safety = { mode: 'block', reason: 'Waiting for positions.' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  await connection.share();
  api.get.mockClear(); api.context.mockClear();
  const paused = { ...state, revision: state.revision + 1, status: 'paused' as const };
  let release!: (s: typeof state) => void;
  api.get.mockResolvedValueOnce(state).mockImplementationOnce(() => new Promise(r => release = r)).mockResolvedValue(paused);
  api.context.mockResolvedValueOnce(paused).mockResolvedValueOnce({ ...state, revision: state.revision + 2 });
  const pause = connection.command('pause');
  await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  const resume = connection.command('resume');
  expect(channel.command).not.toHaveBeenCalledWith('resume');
  await expect(connection.submitInput(JSON.stringify(currentScope(paused)), { kind: 'note', text: 'No competing write' })).rejects.toThrow('Wait');
  release(paused); await pause; await resume;
  expect((api.context.mock.calls as unknown as [string, object][]).map(call => call[1])).toEqual([{ revision: state.revision, action: 'pause' }, { revision: paused.revision, action: 'resume' }]);
  expect(connection.view().phase).toBe('active');
});
it.each(['stop', 'sign-out', 'dispose'] as const)('a queued Resume cannot revive capture after %s invalidates its generation', async ending => {
  const { api, state, channel } = setup();
  mocks.safety = { mode: 'block', reason: 'Waiting for positions.' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  await connection.share();
  let resolve!: (s: typeof state) => void;
  api.context.mockReturnValue(new Promise(r => resolve = r));
  const pause = connection.command('pause');
  await vi.waitFor(() => expect(api.context).toHaveBeenCalled());
  const resume = connection.command('resume');
  const rejected = expect(resume).rejects.toThrow('Share your MATLAB tab');
  if (ending === 'stop') connection.stop(); else if (ending === 'sign-out') cleanup(); else connection.dispose();
  resolve({ ...state, status: 'paused' }); await pause; await rejected;
  expect(channel.command).not.toHaveBeenCalledWith('resume');
  expect(connection.view().phase).toBe('disconnected');
  expect(connection.view().snapshot?.runtime.capture_active).toBe(false);
});
it('a new Share has its own command queue even while an old command response is lost', async () => {
  const { api, state } = setup();
  mocks.safety = { mode: 'block', reason: 'Waiting for positions.' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  await connection.share();
  let release!: (s: typeof state) => void;
  api.context.mockImplementationOnce(() => new Promise(r => release = r));
  const old = connection.command('pause');
  await vi.waitFor(() => expect(api.context).toHaveBeenCalledTimes(1));
  connection.stop(); await connection.share(); await connection.command('pause');
  expect(api.context).toHaveBeenCalledTimes(2);
  const revision = connection.view().state!.revision;
  release({ ...state, revision: revision + 100, status: 'paused' }); await old;
  expect(connection.view().state!.revision).toBe(revision);
  expect(connection.view().phase).toBe('paused');
});
it('a delayed command-error refresh cannot replace guidance after Stop and a new Share', async () => {
  const { api, state } = setup();
  mocks.safety = { mode: 'block', reason: 'Waiting for positions.' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  await connection.share(); api.get.mockClear();
  let release!: (s: typeof state) => void;
  api.get.mockResolvedValueOnce(state).mockImplementationOnce(() => new Promise(r => release = r));
  api.context.mockRejectedValueOnce(new ServiceError('Synthetic interrupted pause'));
  const old = connection.command('pause');
  await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  connection.stop(); await connection.share();
  release({ ...state, revision: state.revision + 100, status: 'paused' }); await old;
  expect(connection.view().state!.revision).toBe(state.revision);
  expect(connection.view().phase).toBe('active');
});
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
it('a skipped frame keeps sharing active, skips the check and sends again on the next tick', async () => {
  const { api, channel, video } = setup();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpg'])));
  channel.sendFrame.mockResolvedValueOnce(null as unknown as typeof receipt.frame);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    await connection.share(); await vi.waitFor(() => expect(channel.sendFrame).toHaveBeenCalledTimes(1));
    expect(api.check).not.toHaveBeenCalled(); expect(connection.view().phase).toBe('active'); expect(video.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000); await vi.waitFor(() => expect(channel.sendFrame).toHaveBeenCalledTimes(2));
    const [first, second] = channel.sendFrame.mock.calls as unknown as [{ sequence: number }][];
    expect(second[0].sequence).toBe(first[0].sequence + 1);
    await vi.waitFor(() => expect(api.check).toHaveBeenCalledTimes(1)); expect(connection.view().phase).toBe('active');
  } finally { vi.useRealTimers(); }
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
it('reload exposes pending creation; only explicit recovery replays once without capture', async () => {
  const { api, state, media } = setup();
  api.get.mockRejectedValue(new ServiceError('Pending', 503, 'lab_creation_pending'));
  await connection.load();
  expect(connection.view().canRecover).toBe(true); expect(api.recover).not.toHaveBeenCalled();
  let resolve!: (s: typeof state) => void;
  api.recover.mockReturnValue(new Promise(r => resolve = r));
  const retry = connection.load(true); await Promise.resolve();
  await connection.load(true); expect(api.recover).toHaveBeenCalledTimes(1);
  resolve(state); await retry;
  expect(connection.view().state?.lab_session_id).toBe(state.lab_session_id);
  expect(connection.view().phase).toBe('disconnected'); expect(media).not.toHaveBeenCalled(); expect(api.screen).not.toHaveBeenCalled();
});
it.each([undefined, 'disabled', 'upstream_unavailable'])('does not create for ambiguous/disabled/unavailable 503 (%s)', async code => {
  const { api } = setup(); api.get.mockRejectedValue(new ServiceError('Unavailable', 503, code));
  await connection.load(true); expect(api.recover).not.toHaveBeenCalled(); expect(connection.view().canRecover).toBe(false);
});
it('a failed recovery is bounded and a later explicit retry can reach the same saved lab', async () => {
  const { api } = setup(); api.get.mockRejectedValue(new ServiceError('Pending', 503, 'lab_creation_pending'));
  api.recover.mockRejectedValueOnce(new ServiceError('Outage', 503));
  await connection.load(true); expect(api.recover).toHaveBeenCalledTimes(1); expect(connection.view().phase).toBe('unavailable');
  await connection.load(true); expect(api.recover).toHaveBeenCalledTimes(2); expect(connection.view().phase).toBe('disconnected');
});
it('navigation during the pending read never posts and a late recovery result cannot update state', async () => {
  const { api, state } = setup();
  let reject!: (reason: unknown) => void;
  api.get.mockReturnValue(new Promise((_, r) => reject = r));
  const reading = connection.load(true); connection.dispose(); reject(new ServiceError('Pending', 503, 'lab_creation_pending')); await reading;
  expect(api.recover).not.toHaveBeenCalled(); expect(connection.view().state).toBeNull();
  const next = setup(); next.api.get.mockRejectedValue(new ServiceError('Pending', 503, 'lab_creation_pending'));
  let resolve!: (s: typeof state) => void; next.api.recover.mockReturnValue(new Promise(r => resolve = r));
  const replaying = connection.load(true); await Promise.resolve(); connection.dispose(); resolve(state); await replaying;
  expect(connection.view().state).toBeNull();
});
it('records student input with the committed revision and adopts the returned state without capture', async () => {
  const { api, state, media } = setup(); await connection.load(); await Promise.resolve();
  const scope = JSON.stringify(currentScope(state));
  await connection.submitInput(scope, { kind: 'observation', text: 'I compared the displayed traces.', self_confidence: 3 });
  expect(api.respond).toHaveBeenCalledWith('prep-test', { revision: state.revision, kind: 'observation', text: 'I compared the displayed traces.', self_confidence: 3 }, expect.any(AbortSignal));
  expect(connection.view().state?.revision).toBe(state.revision + 1); expect(media).not.toHaveBeenCalled();
});
it('rejects blank input, stale context and confirmation without a current checked image', async () => {
  const { api, state } = setup(); await connection.load(); await Promise.resolve();
  const scope = JSON.stringify(currentScope(state));
  await expect(connection.submitInput(scope, { kind: 'note', text: '  ' })).rejects.toMatchObject({ status: 422 });
  await expect(connection.submitInput('old-context', { kind: 'note', text: 'A draft' })).rejects.toMatchObject({ status: 409 });
  await expect(connection.submitInput(scope, { criterion_ids: ['CP-DSB-01:workspace'], review_note: 'I reviewed this workspace.' })).rejects.toMatchObject({ status: 409 });
  expect(api.respond).not.toHaveBeenCalled(); expect(api.review).not.toHaveBeenCalled();
});
it('prevents duplicate student submissions, refreshes after a conflict and never silently retries', async () => {
  const { api, state } = setup(); await connection.load(); await Promise.resolve();
  let reject!: (reason: unknown) => void;
  api.respond.mockReturnValue(new Promise((_, r) => reject = r));
  const scope = JSON.stringify(currentScope(state));
  const pending = connection.submitInput(scope, { kind: 'note', text: 'My own draft' });
  await expect(connection.submitInput(scope, { kind: 'note', text: 'My own draft' })).rejects.toThrow('Wait');
  api.get.mockResolvedValue({ ...state, revision: state.revision + 2 });
  reject(new ServiceError('Changed', 409)); await expect(pending).rejects.toMatchObject({ status: 409 });
  expect(api.respond).toHaveBeenCalledTimes(1); expect(connection.view().state?.revision).toBe(state.revision + 2); expect(connection.view().inputBusy).toBe(false);
});
it('confirms selected criteria only with a current committed candidate while sharing', async () => {
  const { api, state } = setup();
  const committed = receipt.events.find(e => e.type === 'guidance_committed')!.state!;
  const checked = LabExecutionStateSchema.parse({ ...state, ...committed, definition: state.definition });
  api.get.mockResolvedValue(checked); api.attach.mockResolvedValue(checked);
  api.review.mockResolvedValue({ ...checked, revision: checked.revision + 1 });
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(0);
  await connection.load(); await Promise.resolve(); await connection.share();
  await connection.submitInput(JSON.stringify(currentScope(checked)), { criterion_ids: ['CP-DSB-01:project_ref'], review_note: 'I checked my saved model reference.' });
  expect(api.review).toHaveBeenCalledWith('prep-test', { revision: checked.revision, criterion_ids: ['CP-DSB-01:project_ref'], review_note: 'I checked my saved model reference.' }, expect.any(AbortSignal));
  expect(connection.view().state?.revision).toBe(checked.revision + 1);
});
it('declares only the current server-defined condition on an explicit action and rejects an old draft scope', async () => {
  const { api, state } = setup();
  const fault = { ...state, queue: { ...state.queue, current_checkpoint_id: 'CP-DSB-11' } };
  api.get.mockResolvedValue(fault); await connection.load(); await Promise.resolve();
  expect(api.context).not.toHaveBeenCalled();
  await expect(connection.declareCondition('old-step')).rejects.toMatchObject({ status: 409 });
  api.context.mockResolvedValue({ ...fault, revision: fault.revision + 1, workspace: { ...fault.workspace, condition: 'phase_fault' } });
  await connection.declareCondition(JSON.stringify(currentScope(fault)));
  expect(api.context).toHaveBeenCalledWith('prep-test', { revision: fault.revision, action: 'condition', condition: 'phase_fault' }, expect.any(AbortSignal));
  expect(connection.view().state?.workspace.condition).toBe('phase_fault');
});
