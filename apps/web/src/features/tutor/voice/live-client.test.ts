import { expect, it, vi } from 'vitest';
import { LIVE_URL, LiveVoice, b64ToInt16, int16ToB64, type LiveEvents } from './live-client';

class FakeSocket {
  readyState = 0; sent: unknown[] = []; url: string;
  onopen: ((e: Event) => void) | null = null; onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null; onerror: ((e: Event) => void) | null = null;
  constructor(url: string) { this.url = url; }
  send(d: string) { this.sent.push(JSON.parse(d)); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(new Event('open')); }
  async server(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent); await new Promise(r => setTimeout(r, 0)); }
  drop(code: number, reason = '') { this.readyState = 3; this.onclose?.({ code, reason } as CloseEvent); }
}

function setup() {
  let sock!: FakeSocket;
  const events: LiveEvents = {
    ready: vi.fn(), audio: vi.fn(), kikiText: vi.fn(), studentText: vi.fn(), turnDone: vi.fn(), interrupted: vi.fn(), closed: vi.fn(),
    reply: vi.fn(async (heard: string) => ({ mode: 'scripted' as const, lang: 'en' as const, say: `next after ${heard}`, expectsReply: true })),
  };
  const live = new LiveVoice(events, (u) => (sock = new FakeSocket(u)) as never);
  return { live, events, sock: () => sock };
}

it('round-trips PCM through base64', () => {
  const pcm = Int16Array.from([0, 1, -1, 32767, -32768, 1234]);
  expect([...b64ToInt16(int16ToB64(pcm))]).toEqual([...pcm]);
});

it('connects to the constrained endpoint and sends only the model in setup', () => {
  const { live, sock } = setup();
  live.connect('auth_tokens/abc', 'gemini-3.8-live');
  expect(sock().url).toBe(`${LIVE_URL}?access_token=auth_tokens%2Fabc`);
  sock().open();
  expect(sock().sent[0]).toEqual({ setup: { model: 'models/gemini-3.8-live' } });
});

it('speaks briefs, streams audio and transcripts, and answers submit_reply with the tutor brief', async () => {
  const { live, events, sock } = setup();
  live.connect('t', 'gemini-3.8-live'); sock().open();
  await sock().server({ setupComplete: {} });
  expect(events.ready).toHaveBeenCalled();
  live.speak({ mode: 'scripted', lang: 'en', say: 'At 60°?', expectsReply: true });
  expect(sock().sent[1]).toEqual({ clientContent: { turns: [{ role: 'user', parts: [{ text: 'BRIEF {"mode":"scripted","lang":"en","say":"At 60°?","expectsReply":true}' }] }], turnComplete: true } });
  await sock().server({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: int16ToB64(Int16Array.from([5, 6])) } }] }, outputTranscription: { text: 'At ' } } });
  await sock().server({ serverContent: { outputTranscription: { text: '60°?' } } });
  expect([...(vi.mocked(events.audio).mock.calls[0][0])]).toEqual([5, 6]);
  expect(events.kikiText).toHaveBeenLastCalledWith('At 60°?');
  await sock().server({ serverContent: { turnComplete: true } });
  expect(events.turnDone).toHaveBeenCalledWith('At 60°?');
  await sock().server({ serverContent: { inputTranscription: { text: 'part of ' } } });
  await sock().server({ serverContent: { inputTranscription: { text: 'it' } } });
  expect(events.studentText).toHaveBeenLastCalledWith('part of it');
  await sock().server({ toolCall: { functionCalls: [{ id: 'call-1', name: 'submit_reply', args: { heard_text: 'part of it', lang: 'en' } }] } });
  expect(events.reply).toHaveBeenCalledWith('part of it', 'en', 'part of it');
  expect(sock().sent.at(-1)).toEqual({ toolResponse: { functionResponses: [{ id: 'call-1', name: 'submit_reply',
    response: { brief: { mode: 'scripted', lang: 'en', say: 'next after part of it', expectsReply: true } } }] } });
});

it('ignores other tools, reports barge-in, and sends mic audio as 16 kHz PCM', async () => {
  const { live, events, sock } = setup();
  live.connect('t', 'm'); sock().open();
  await sock().server({ toolCall: { functionCalls: [{ id: 'x', name: 'open_url', args: {} }] } });
  expect(events.reply).not.toHaveBeenCalled();
  await sock().server({ serverContent: { interrupted: true } });
  expect(events.interrupted).toHaveBeenCalled();
  live.sendAudio(Int16Array.from([1, 2]));
  expect(sock().sent.at(-1)).toEqual({ realtimeInput: { audio: { data: int16ToB64(Int16Array.from([1, 2])), mimeType: 'audio/pcm;rate=16000' } } });
});

it('keeps the resumption handle, resumes with it, and tells a policy close from a drop', async () => {
  const { live, events, sock } = setup();
  live.connect('t', 'm'); sock().open();
  await sock().server({ sessionResumptionUpdate: { newHandle: 'h-1', resumable: true } });
  expect(live.handle).toBe('h-1');
  sock().drop(1006);
  expect(events.closed).toHaveBeenLastCalledWith('closed (1006)', true);
  live.connect('t2', 'm', live.handle); sock().open();
  expect(sock().sent[0]).toEqual({ setup: { model: 'models/m', sessionResumption: { handle: 'h-1' } } });
  sock().drop(1008, 'Session closed due to client inactivity.');
  expect(events.closed).toHaveBeenLastCalledWith('Session closed due to client inactivity.', false);
});

it('does not report a close it asked for, and never sends before the socket is open', () => {
  const { live, events, sock } = setup();
  live.connect('t', 'm');
  live.sendText('early');
  expect(sock().sent).toEqual([]);
  live.close();
  sock().drop(1000);
  expect(events.closed).not.toHaveBeenCalled();
});
