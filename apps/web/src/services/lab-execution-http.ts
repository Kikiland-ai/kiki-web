import { z } from 'zod';
import type { AuthService } from '../contracts/services';
import { CaptureSessionSchema, ExecutionEnvelopeSchema, FrameReceiptSchema, type FrameMetadata, type FrameChannel, type LabExecutionApi } from '../contracts/lab-execution';
import { ServiceError } from './types';

export function createLabExecutionApi(baseUrl: string, auth: AuthService, fetcher: typeof fetch = fetch, Socket: typeof WebSocket = WebSocket): LabExecutionApi {
  const base = baseUrl.replace(/\/$/, '');
  const root = (id: string) => `${base}/lab-preparations/${encodeURIComponent(id)}/execution`;
  async function request(id: string, suffix = '', method = 'GET', body?: unknown, signal?: AbortSignal) {
    const response = await fetcher(root(id) + suffix, {
      method, headers: { Authorization: `Bearer ${await auth.getIdToken()}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new ServiceError(response.status === 409 ? 'The lab changed. Refresh before trying again.' : response.status === 401 ? 'Sign in again to reconnect your lab.' : response.status === 404 ? 'This lab connection was not found for your account.' : 'Lab tracking is unavailable; your progress is kept.', response.status);
    return response;
  }
  async function state(id: string, suffix = '', body?: unknown, signal?: AbortSignal) {
    const response = await request(id, suffix, body === undefined ? 'GET' : 'POST', body, signal);
    const parsed = ExecutionEnvelopeSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.preparationId !== id) throw new ServiceError('The lab service returned an unsupported session.');
    return parsed.data.state;
  }
  return {
    start: (id, s) => state(id, '', {}, s), get: (id, s) => state(id, '', undefined, s),
    screen: async (id, s) => CaptureSessionSchema.parse(await (await request(id, '/screen-sessions', 'POST', {}, s)).json()),
    attach: (id, revision, capture_session_id, s) => state(id, '/attach', { revision, capture_session_id }, s),
    context: (id, command, s) => state(id, '/context', command, s),
    check: (id, body, s) => request(id, '/check-stream', 'POST', body, s),
    review: (id, body, s) => state(id, '/review', body, s), respond: (id, body, s) => state(id, '/responses', body, s),
    async channel(id, sid, onDisconnect, signal) {
      const ticket = z.object({ ticket: z.string().max(2048), expiresInSeconds: z.literal(60) }).parse(await (await request(id, '/stream-ticket', 'POST', { screenSessionId: sid }, signal)).json());
      const url = new URL(root(id) + `/screen-sessions/${encodeURIComponent(sid)}/stream`);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('ticket', ticket.ticket);
      const socket = new Socket(url.toString());
      let ended = false, settled = false;
      let control: { status: string; resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> } | null = null;
      let pending: { metadata: FrameMetadata; resolve(value: z.infer<typeof FrameReceiptSchema>): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> } | null = null;
      let resolveReady!: () => void, rejectReady!: (error: Error) => void;
      const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
      ready.catch(() => undefined);
      const fail = () => {
        if (ended) return; ended = true;
        clearTimeout(deadline); signal?.removeEventListener('abort', close);
        const error = new ServiceError('The shared tab disconnected. Share your MATLAB tab again.');
        if (!settled) rejectReady(error);
        if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; }
        if (control) { clearTimeout(control.timer); control.reject(error); control = null; }
        socket.close(); onDisconnect();
      };
      const close = () => fail();
      const deadline = setTimeout(fail, 10000);
      socket.addEventListener('error', fail); socket.addEventListener('close', fail);
      socket.addEventListener('message', event => {
        try {
          if (typeof event.data !== 'string' || event.data.length > 1_000_000) throw new Error();
          const message = JSON.parse(event.data);
          if (['connected', 'status', 'ack'].includes(message.type) && (message.observation?.schema !== 'screen-receiver/v1' || message.observation?.session_id !== sid)) throw new Error('Foreign receiver.');
          if (message.type === 'connected') { settled = true; clearTimeout(deadline); resolveReady(); }
          if (message.type === 'status' && control && message.observation?.capture_status === control.status) {
            clearTimeout(control.timer); control.resolve(); control = null;
          }
          if (message.type === 'ack' && pending) {
            const receipt = FrameReceiptSchema.parse(message.observation?.observation?.latest_frame);
            if (receipt.frame_id !== `${sid}:${pending.metadata.capture_epoch}:${pending.metadata.sequence}`
              || (['width', 'height', 'byte_count', 'view_revision'] as const).some(key => receipt[key] !== pending!.metadata[key])) throw new Error('Foreign frame acknowledgement.');
            clearTimeout(pending.timer); pending.resolve(receipt); pending = null;
          }
        } catch { fail(); }
      });
      signal?.addEventListener('abort', close, { once: true });
      if (signal?.aborted) close();
      const channel: FrameChannel = {
        ready,
        async sendFrame(metadata, image) {
          await ready;
          if (ended || pending || socket.readyState !== Socket.OPEN || image.size > 1_000_000 || image.size !== metadata.byte_count) throw new ServiceError('The frame connection is not ready.');
          return new Promise((resolve, reject) => {
            pending = { metadata, resolve, reject, timer: setTimeout(fail, 10000) };
            try { socket.send(JSON.stringify(metadata)); socket.send(image); } catch { fail(); }
          });
        },
        command(type) {
          if (ended || socket.readyState !== Socket.OPEN) return type === 'stop' || type === 'heartbeat' ? Promise.resolve() : Promise.reject(new ServiceError('Share your MATLAB tab again to reconnect.'));
          if (type === 'heartbeat' || type === 'stop') { socket.send(JSON.stringify({ type })); return Promise.resolve(); }
          if (control) return Promise.reject(new ServiceError('Wait for the current sharing action.'));
          return new Promise<void>((resolve, reject) => {
            control = { status: type === 'pause' ? 'paused' : 'sharing', resolve, reject, timer: setTimeout(fail, 10000) };
            try { socket.send(JSON.stringify({ type })); } catch { fail(); }
          });
        }, close,
      };
      return channel;
    },
  };
}
