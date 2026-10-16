import { describe, expect, it, vi } from 'vitest';
import { withResourceCleanup } from './resource-cleanup';
import type { AuthDriver, Identity } from '../contracts/services';

function driver() {
  let notify: (user: Identity | null) => void = () => undefined;
  const signOut = vi.fn(async () => undefined);
  const auth: AuthDriver = { subscribe: (cb) => { notify = cb; return () => undefined; }, signIn: vi.fn(), signOut, getIdToken: async () => 'synthetic-token' };
  return { auth, signOut, emit: (uid: string | null) => notify(uid ? { uid, displayName: uid } : null) };
}
describe('shared resource cleanup', () => {
  it('stops all local resources before Firebase sign-out even if one release fails', async () => {
    const events: string[] = [];
    const d = driver();
    d.signOut.mockImplementation(async () => { events.push('firebase'); });
    const auth = withResourceCleanup(d.auth);
    auth.registerSignOutCleanup(() => { events.push('audio'); throw new Error('release failed'); });
    auth.registerSignOutCleanup(async () => { events.push('overlay'); });
    await auth.signOut();
    expect(events).toEqual(['audio', 'overlay', 'firebase']);
  });
  it('does not let a hung network release prevent sign-out', async () => {
    vi.useFakeTimers();
    try {
      const d = driver(); const auth = withResourceCleanup(d.auth, 3000);
      auth.registerSignOutCleanup(() => new Promise(() => undefined));
      const signingOut = auth.signOut();
      await vi.advanceTimersByTimeAsync(3000);
      await signingOut;
      expect(d.signOut).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it('runs local cleanup immediately on auth loss or account change', async () => {
    const d = driver(); const auth = withResourceCleanup(d.auth);
    auth.subscribe(() => undefined, () => undefined);
    d.emit('student-a');
    const cleanup = vi.fn(); auth.registerSignOutCleanup(cleanup);
    d.emit('student-b');
    expect(cleanup).toHaveBeenCalledOnce();
    const nextCleanup = vi.fn(); auth.registerSignOutCleanup(nextCleanup);
    d.emit(null);
    expect(nextCleanup).toHaveBeenCalledOnce();
    await auth.signOut();
    expect(nextCleanup).toHaveBeenCalledOnce();
  });
  it('supports unregistering resources when their feature unmounts', async () => {
    const auth = withResourceCleanup(driver().auth);
    const cleanup = vi.fn(); auth.registerSignOutCleanup(cleanup)();
    await auth.signOut(); expect(cleanup).not.toHaveBeenCalled();
  });
});
