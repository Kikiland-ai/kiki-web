import { expect, it, vi } from 'vitest';
import { createTutorApi } from './tutor-http';

const auth = { getIdToken: async () => 'synthetic-test-token' } as never;
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

it('sends the bearer token and idempotency key on turns', async () => {
  const fetcher = vi.fn(async () => ok({ leaks: ['half'] }));
  const api = createTutorApi('https://api.example/', auth, fetcher as unknown as typeof fetch);
  await expect(api.speech('ts-1', 'half')).resolves.toEqual({ leaks: ['half'] });
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.example/tutor/sessions/ts-1/speech');
  expect(init.headers).toEqual({ Authorization: 'Bearer synthetic-test-token', 'Content-Type': 'application/json' });
  const turn = vi.fn(async () => new Response(JSON.stringify({ detail: 'This session is complete.' }), { status: 409 }));
  await expect(createTutorApi('https://api.example', auth, turn as unknown as typeof fetch).turn('ts-1', { chip: 'half' }, 'key-12345'))
    .rejects.toMatchObject({ message: 'This session is complete.', status: 409 });
  const [, tinit] = turn.mock.calls[0] as unknown as [string, RequestInit];
  expect((tinit.headers as Record<string, string>)['Idempotency-Key']).toBe('key-12345');
  expect(JSON.parse(tinit.body as string)).toEqual({ chip: 'half' });
});

it('rejects a response that does not match the tutor contract', async () => {
  const api = createTutorApi('https://api.example', auth, (async () => ok({ sessionId: 1 })) as unknown as typeof fetch);
  await expect(api.get('ts-1')).rejects.toThrow('unsupported tutor response');
});

it('explains voice being unavailable with the server message', async () => {
  const api = createTutorApi('https://api.example', auth, (async () => new Response(JSON.stringify({ detail: 'Voice is not available. Continue by typing.' }), { status: 503 })) as unknown as typeof fetch);
  await expect(api.voiceToken('ts-1')).rejects.toThrow('Continue by typing');
});
