// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from './Session';
import type { Services, Identity } from '../services/types';
import type { Profile } from '../contracts/profile';

afterEach(cleanup);
const profile = (id: string): Profile => ({ schema: 'profile/v1', id, displayName: id, supportLanguage: 'or', dialLevel: 2, courseIds: [], onboarding: { step: 0, completedAt: null, fluencySelfRatings: null, easyLanguageAnswer: null } });
function Probe() { const session = useSession(); return <div><span data-testid="status">{session.status}</span><span data-testid="identity">{session.identity?.uid ?? 'none'}</span><span data-testid="profile">{session.profile?.id ?? 'none'}</span><span>{session.error}</span><button onClick={session.retry}>Retry</button><button onClick={() => { session.logout().catch(() => undefined); }}>Logout</button></div>; }
function harness(bootstrap: Services['api']['bootstrap']) {
  let listener: (user: Identity | null) => void = () => undefined;
  const unsubscribe = vi.fn();
  let authError: (error: Error) => void = () => undefined;
  const services: Services = { mode: 'connected', labPreparation:{practical:vi.fn(),active:vi.fn(),start:vi.fn(),get:vi.fn(),save:vi.fn()}, learning: { getChapter: vi.fn(), getConceptLesson: vi.fn(), getProgress: vi.fn(), savePosition: vi.fn() }, media: { getManifest: vi.fn(), loadNarration: vi.fn() }, assessments: { start: vi.fn(), get: vi.fn(), saveDraft: vi.fn(), submit: vi.fn(), getResult: vi.fn(), overview: vi.fn() }, intake: { list: vi.fn(), get: vi.fn(), create: vi.fn(), confirm: vi.fn(), retry: vi.fn(), source: vi.fn() }, auth: {
    registerSignOutCleanup: () => () => undefined, subscribe: (callback, onError) => { listener = callback; authError = onError; return unsubscribe; }, signIn: vi.fn(), signOut: async () => listener(null), getIdToken: async () => 'synthetic-unit-token',
  }, api: { bootstrap, getProfile: vi.fn(), updateProfile: vi.fn(), enroll: vi.fn() } };
  const view = render(<SessionProvider services={services}><Probe /></SessionProvider>);
  return { view, emit: (id: string | null) => act(() => listener(id ? { uid: id, displayName: id } : null)), unsubscribe, authError: (error: Error) => act(() => authError(error)) };
}
describe('authenticated profile lifecycle', () => {
  it('clears stale Firebase identity as well as private profile on observer errors', async () => {
    const h = harness(async () => profile('student-a')); h.emit('student-a');
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe('student-a'));
    h.authError(Object.assign(new Error('Auth observer failed'), { code:'auth/network-request-failed' }));
    expect(screen.getByTestId('identity').textContent).toBe('none');
    expect(screen.getByTestId('profile').textContent).toBe('none');
    expect(screen.getByTestId('status').textContent).toBe('error');
  });
  it('rejects a profile belonging to another account', async () => {
    const h = harness(async () => profile('other-student'));
    h.emit('student-a');
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('profile').textContent).toBe('none');
    expect(screen.getByText(/does not match your signed-in account/)).toBeDefined();
  });
  it('ignores an obsolete bootstrap that completes after account switching', async () => {
    let finishA: (p: Profile) => void = () => undefined;
    const first = new Promise<Profile>(resolve => { finishA = resolve; });
    const bootstrap = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(profile('student-b'));
    const h = harness(bootstrap);
    h.emit('student-a'); h.emit('student-b');
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe('student-b'));
    await act(async () => finishA(profile('student-a')));
    expect(screen.getByTestId('profile').textContent).toBe('student-b');
    expect((bootstrap.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
  });
  it('clears private profile state immediately when auth is lost and unsubscribes on unmount', async () => {
    const h = harness(async () => profile('student-a'));
    h.emit('student-a');
    await waitFor(() => expect(screen.getByTestId('profile').textContent).toBe('student-a'));
    h.emit(null);
    expect(screen.getByTestId('profile').textContent).toBe('none');
    expect(screen.getByTestId('status').textContent).toBe('signedout');
    h.view.unmount(); expect(h.unsubscribe).toHaveBeenCalledOnce();
  });
});
