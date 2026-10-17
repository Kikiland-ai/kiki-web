import { describe, expect, it, vi } from 'vitest';
import { createLearnerApi } from './http';
import type { AuthService } from './types';
const auth = { getIdToken: async () => 'synthetic-unit-test-token' } as AuthService;
describe('Python API boundary', () => {
  it('uses a bearer token, no client-asserted UID, and a repeat-safe bootstrap', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ profile: { schema: 'profile/v1', id: 'test-user', displayName: 'Student', supportLanguage: 'or', dialLevel: 2, courseIds: [], onboarding: { step: 0, completedAt: null, fluencySelfRatings: null, easyLanguageAnswer: null } } })));
    const api = createLearnerApi('http://localhost:8000/', auth, fetcher);
    expect((await api.bootstrap()).id).toBe('test-user');
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8000/learners/me/bootstrap', expect.objectContaining({ method: 'POST', body: undefined, headers: expect.objectContaining({ Authorization: 'Bearer synthetic-unit-test-token' }) }));
  });
  it('does not turn a rejected save into success or fixture data', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 503 }));
    await expect(createLearnerApi('http://localhost', auth, fetcher).enroll('CRS-AC-ECE', 5)).rejects.toThrow('not saved');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid API shapes instead of rendering trusted profile state', async () => {
    await expect(createLearnerApi('http://localhost', auth, async () => new Response('{"profile":{"signedIn":true}}')).bootstrap()).rejects.toThrow('unsupported response');
  });
  it('surfaces ownership denial without printing backend data', async () => {
    await expect(createLearnerApi('http://localhost', auth, async () => new Response('private details', { status: 403 })).bootstrap()).rejects.toThrow('do not have access');
  });
  it('reads the same canonical profile envelope from the aligned getProfile endpoint', async () => {
    const profile = { schema: 'profile/v1', id: 'test-user', displayName: 'Student', supportLanguage: 'or', dialLevel: 2, courseIds: [], onboarding: { step: 0, completedAt: null, fluencySelfRatings: null, easyLanguageAnswer: null } };
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ profile })));
    expect(await createLearnerApi('http://localhost/v1', auth, fetcher).getProfile()).toEqual(profile);
    expect(fetcher).toHaveBeenCalledWith('http://localhost/v1/learners/me/profile', expect.objectContaining({ method: 'GET' }));
  });
});
