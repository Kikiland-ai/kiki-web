import { it, expect, vi } from 'vitest';
import { createLabExecutionApi } from './lab-execution-http';
import type { AuthService } from '../contracts/services';
import type { FrameMetadata } from '../contracts/lab-execution';
import receipt from '../features/labs/__fixtures__/python-execution.json';
const prep = 'prep-12345678-1234-1234-1234-123456789abc';
const auth = { getIdToken: async () => 'private-test-bearer' } as AuthService;
const envelope = { schema: 'lab-execution/v1', preparationId: prep, backendLabId: receipt.start.lab_session_id, state: receipt.start };
class Socket extends EventTarget {
  static OPEN = 1; static last: Socket; readyState = 1; sent: unknown[] = []; url: string;
  constructor(url: string) { super(); this.url = url; Socket.last = this; }
  send(value: unknown) { this.sent.push(value); }
  close() { this.readyState = 3; }
  packet(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
}
const socketClass = Socket as unknown as typeof WebSocket;
it('sends bearer only to apps/api, rejects unsupported/foreign state and preserves HTTP status', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(envelope));
  const api = createLabExecutionApi('http://localhost:8002', auth, fetcher, socketClass);
  await api.start(prep); expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error', headers: { Authorization: 'Bearer private-test-bearer' } });
  fetcher.mockResolvedValueOnce(Response.json({ ...envelope, preparationId: prep.replace('abc', 'aaa') }));
  await expect(api.get(prep)).rejects.toThrow('unsupported');
  fetcher.mockResolvedValueOnce(new Response('', { status: 409 })); await expect(api.get(prep)).rejects.toMatchObject({ status: 409 });
  fetcher.mockResolvedValueOnce(new Response('', { status: 503 })); await expect(api.get(prep)).rejects.toThrow('progress is kept');
});
it('exposes only a valid 503 pending-creation code, never arbitrary error text or codes', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const api = createLabExecutionApi('http://localhost:8002', auth, fetcher, socketClass);
  fetcher.mockResolvedValueOnce(Response.json({ code: 'lab_creation_pending', detail: 'untrusted detail' }, { status: 503 }));
  await expect(api.get(prep)).rejects.toMatchObject({ code: 'lab_creation_pending', status: 503 });
  fetcher.mockResolvedValueOnce(Response.json(envelope)); await api.recover(prep);
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string)).toEqual({ recoverPending: true });
  for (const [status, body] of [[503, { code: 'disabled' }], [409, { code: 'lab_creation_pending' }], [503, null]] as const) {
    fetcher.mockResolvedValueOnce(Response.json(body, { status }));
    await expect(api.get(prep)).rejects.toMatchObject({ code: undefined, status });
  }
});
it('WebSocket URL contains only a one-time ticket and verifies frame acknowledgement identity', async () => {
  const api = createLabExecutionApi('http://localhost:8002', auth, async () => Response.json({ ticket: 'one-use-capability', expiresInSeconds: 60 }), socketClass);
  const onDisconnect = vi.fn(); const channel = await api.channel(prep, 'screen', onDisconnect);
  expect(Socket.last.url).toContain('ticket=one-use-capability'); expect(Socket.last.url).not.toContain('private-test-bearer');
  const observation = { schema: 'screen-receiver/v1', session_id: 'screen' };
  Socket.last.packet({ type: 'connected', observation }); await channel.ready;
  const sharing = channel.command('capture_started');
  Socket.last.packet({ type: 'status', observation: { ...observation, capture_status: 'sharing' } }); await sharing;
  const metadata: FrameMetadata = { type: 'frame', capture_epoch: 1, view_revision: 1, sequence: 1, captured_elapsed_ms: 0, width: 96, height: 54, source_width: 96, source_height: 54, byte_count: 3, mime_type: 'image/jpeg' };
  const pending = channel.sendFrame(metadata, new Blob(['jpg'])); await Promise.resolve();
  Socket.last.packet({ type: 'ack', observation: { ...observation, observation: { latest_frame: { ...receipt.frame, frame_id: 'screen:1:1', byte_count: 3 } } } });
  await expect(pending).resolves.toMatchObject({ frame_id: 'screen:1:1' });
  const foreign = channel.sendFrame({ ...metadata, sequence: 2 }, new Blob(['jpg'])); await Promise.resolve();
  Socket.last.packet({ type: 'ack', observation: { ...observation, observation: { latest_frame: { ...receipt.frame, frame_id: 'foreign:1:2', byte_count: 3 } } } });
  await expect(foreign).rejects.toThrow('disconnected'); expect(onDisconnect).toHaveBeenCalledTimes(1);
});
it('a sampling-limit skip settles that frame without disconnecting the share', async () => {
  vi.useFakeTimers();
  try {
    const api = createLabExecutionApi('http://localhost:8002', auth, async () => Response.json({ ticket: 'one-use-capability', expiresInSeconds: 60 }), socketClass);
    const onDisconnect = vi.fn(); const channel = await api.channel(prep, 'screen', onDisconnect);
    const observation = { schema: 'screen-receiver/v1', session_id: 'screen' };
    Socket.last.packet({ type: 'connected', observation }); await channel.ready;
    const metadata: FrameMetadata = { type: 'frame', capture_epoch: 1, view_revision: 1, sequence: 1, captured_elapsed_ms: 0, width: 96, height: 54, source_width: 96, source_height: 54, byte_count: 3, mime_type: 'image/jpeg' };
    const skipped = channel.sendFrame(metadata, new Blob(['jpg'])); await Promise.resolve();
    Socket.last.packet({ type: 'skipped', reason: 'sampling_limit' });
    await expect(skipped).resolves.toBeNull();
    // The cleared acknowledgement timer can no longer end the share.
    vi.advanceTimersByTime(15000); expect(onDisconnect).not.toHaveBeenCalled();
    const next = channel.sendFrame({ ...metadata, sequence: 2 }, new Blob(['jpg'])); await Promise.resolve();
    Socket.last.packet({ type: 'ack', observation: { ...observation, observation: { latest_frame: { ...receipt.frame, frame_id: 'screen:1:2', byte_count: 3 } } } });
    await expect(next).resolves.toMatchObject({ frame_id: 'screen:1:2' }); expect(onDisconnect).not.toHaveBeenCalled();
    const malformed = channel.sendFrame({ ...metadata, sequence: 3 }, new Blob(['jpg'])); await Promise.resolve();
    Socket.last.packet({ type: 'skipped' });
    await expect(malformed).rejects.toThrow('disconnected'); expect(onDisconnect).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
