import type { AuthDriver, AuthService, Identity, SignOutCleanup } from '../contracts/services';

/** Local stop/hide happens synchronously in each cleanup; network release gets a deadline.
 * A failed release cannot prevent Firebase sign-out. Server leases still expire.
 */
export function withResourceCleanup(driver: AuthDriver, deadlineMs = 3000): AuthService {
  const cleanups = new Set<SignOutCleanup>();
  let previousIdentity: Identity | null = null;
  async function releaseResources() {
    const tasks = [...cleanups];
    cleanups.clear();
    await Promise.allSettled(tasks.map(cleanup => new Promise<void>((resolve) => {
      const deadline = setTimeout(resolve, deadlineMs);
      try {
        Promise.resolve(cleanup()).catch(() => undefined).finally(() => { clearTimeout(deadline); resolve(); });
      } catch { clearTimeout(deadline); resolve(); }
    })));
  }
  return {
    ...driver,
    subscribe: (listener, onError) => driver.subscribe(identity => {
      if (previousIdentity && identity?.uid !== previousIdentity.uid) void releaseResources();
      previousIdentity = identity;
      listener(identity);
    }, error => { previousIdentity = null; void releaseResources(); onError(error); }),
    registerSignOutCleanup: cleanup => { cleanups.add(cleanup); return () => { cleanups.delete(cleanup); }; },
    signOut: async () => { await releaseResources(); await driver.signOut(); },
  };
}
