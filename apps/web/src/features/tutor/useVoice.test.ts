import { expect, it, vi } from 'vitest';
import { LiveVoice, type LiveEvents } from './voice/live-client';
import { MAX_RESUMES, shouldResume, voiceErrorMessage } from './useVoice';

it('resumes only an active session, after a recoverable drop, a bounded number of times', () => {
  expect(shouldResume(true, 0, true)).toBe(true);
  expect(shouldResume(true, MAX_RESUMES - 1, true)).toBe(true);
  expect(shouldResume(true, MAX_RESUMES, true)).toBe(false);
  expect(shouldResume(false, 0, true)).toBe(false);     // policy close (1008) or no handle yet
  expect(shouldResume(true, 0, false)).toBe(false);     // the student switched voice off
});

it('explains microphone problems in words a student can act on', () => {
  expect(voiceErrorMessage(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toMatch(/microphone is blocked/);
  expect(voiceErrorMessage(Object.assign(new Error('x'), { name: 'NotFoundError' }))).toMatch(/No microphone/);
  expect(voiceErrorMessage(Object.assign(new Error('x'), { name: 'NotReadableError' }))).toMatch(/Another app/);
});

it('surfaces the server going-away notice so the client can reconnect with its handle', async () => {
  const goAway = vi.fn();
  let sock: { onopen: (e: Event) => void; onmessage: (e: MessageEvent) => void; readyState: number; send: () => void; close: () => void } | undefined;
  const live = new LiveVoice({ goAway } as unknown as LiveEvents, () => (sock = { onopen: () => {}, onmessage: () => {}, readyState: 1, send: () => {}, close: () => {} }) as never);
  live.connect('t', 'm');
  sock!.onmessage({ data: JSON.stringify({ sessionResumptionUpdate: { newHandle: 'h-9', resumable: true } }) } as MessageEvent);
  sock!.onmessage({ data: JSON.stringify({ goAway: { timeLeft: '10s' } }) } as MessageEvent);
  await new Promise(r => setTimeout(r, 0));
  expect(goAway).toHaveBeenCalledOnce();
  expect(live.handle).toBe('h-9');
});
