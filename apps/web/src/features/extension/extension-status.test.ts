// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CHANNEL, CHECK_INTERVAL, compareVersions, observeLegacyAnnouncements, validVersion, watchExtension, type ExtensionState } from './extension-status';
let watcher: ReturnType<typeof watchExtension>;
let states: ExtensionState[];
const message = (body: object, origin = location.origin, source: MessageEventSource = window) => window.dispatchEvent(new MessageEvent('message', { source, origin, data: { channel: CHANNEL, direction: 'extension', ...body } }));
const release = (version = '0.1.4') => ({ ok: true, json: async () => ({ version }) });
let post: ReturnType<typeof vi.spyOn>;
function start() { watcher = watchExtension(s => states.push(s)); }
function reply(version = '0.1.4') { const request = post.mock.calls.at(-1)![0]; message({ type: 'extension_status', request_id: request.request_id, version }); }
beforeEach(() => {
  vi.useFakeTimers(); states = [];
  vi.stubGlobal('fetch', vi.fn(async () => release()));
  post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
});
afterEach(() => { watcher?.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('compares Chrome versions numerically including different lengths and rejects malformed versions', () => {
  expect(compareVersions('0.1.10', '0.1.4')).toBeGreaterThan(0);
  expect(compareVersions('1.2', '1.2.0.0')).toBe(0);
  expect(compareVersions('0.1.3', '0.1.4')).toBeLessThan(0);
  for (const value of ['', '1.2.x', '1.2.3.4.5', '65536', null]) expect(validVersion(value)).toBe(false);
});
it('starts checking, then shows missing after a bounded timeout', async () => {
  start(); expect(states.at(-1)?.kind).toBe('checking');
  await vi.advanceTimersByTimeAsync(2500); expect(states.at(-1)).toMatchObject({ kind: 'missing', latest: '0.1.4' });
  expect(post.mock.calls.every(([m]: [Record<string, unknown>]) => m.type === 'reader_status')).toBe(true);
});
it('shows green for the latest or newer version and yellow after a release change', async () => {
  start(); reply('0.1.10'); await vi.advanceTimersByTimeAsync(1); expect(states.at(-1)?.kind).toBe('current');
  vi.mocked(fetch).mockResolvedValue(release('0.2.0') as Response);
  await vi.advanceTimersByTimeAsync(CHECK_INTERVAL); reply('0.1.10');
  expect(states.at(-1)).toMatchObject({ kind: 'outdated', installed: '0.1.10', latest: '0.2.0' });
});
it('ignores foreign origins/windows, invalid versions and mismatched request ids', async () => {
  start();
  const m = { type: 'extension_status', request_id: post.mock.calls[0][0].request_id, version: '0.1.4' };
  message(m, 'https://other.example'); message(m, location.origin, {} as Window); message({ ...m, request_id: 'wrong' }); message({ ...m, version: 'banana' });
  await vi.advanceTimersByTimeAsync(2500); expect(states.at(-1)?.kind).toBe('missing');
});
it('marks a disabled or removed modern extension red on a recurring check', async () => {
  start(); reply(); await vi.advanceTimersByTimeAsync(2500); expect(states.at(-1)?.kind).toBe('current');
  await vi.advanceTimersByTimeAsync(CHECK_INTERVAL); expect(states.at(-1)?.kind).toBe('missing');
});
it('retains known legacy installs as yellow when they cannot answer probes', async () => {
  start(); message({ type: 'extension_present', version: '0.1.3' });
  await vi.advanceTimersByTimeAsync(CHECK_INTERVAL + 2500);
  expect(states.at(-1)).toMatchObject({ kind: 'outdated', installed: '0.1.3' });
});
it('never reports current when release metadata fails or is invalid', async () => {
  vi.mocked(fetch).mockRejectedValue(new Error('offline')); start(); reply();
  await vi.advanceTimersByTimeAsync(1); expect(states.at(-1)?.kind).toBe('unknown');
  vi.mocked(fetch).mockResolvedValue(release('invalid') as Response);
  await watcher.check(); reply(); expect(states.at(-1)?.kind).toBe('unknown');
});
it('rechecks on focus and cleans up requests, timers and listeners on sign-out/unmount', async () => {
  start(); reply(); await vi.advanceTimersByTimeAsync(1);
  window.dispatchEvent(new Event('focus')); expect(post).toHaveBeenCalledTimes(2);
  watcher.dispose(); const count = states.length;
  window.dispatchEvent(new Event('focus')); message({ type: 'extension_present', version: '0.1.3' });
  await vi.advanceTimersByTimeAsync(CHECK_INTERVAL * 2);
  expect(post).toHaveBeenCalledTimes(2); expect(states).toHaveLength(count);
});
it('skips checks while hidden and rechecks when visible', async () => {
  start(); await vi.advanceTimersByTimeAsync(1);
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  await vi.advanceTimersByTimeAsync(CHECK_INTERVAL); expect(post).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange'));
  expect(post).toHaveBeenCalledTimes(2);
});

it('recognizes an old extension announced before sign-in mounts the header', async () => {
  const stop = observeLegacyAnnouncements();
  try {
    message({ type: 'extension_present', version: '0.1.3' });
    start(); await vi.advanceTimersByTimeAsync(2500);
    expect(states.at(-1)).toMatchObject({ kind: 'outdated', installed: '0.1.3' });
  } finally { stop(); }
});
