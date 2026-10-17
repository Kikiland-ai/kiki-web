import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import type { AuthDriver } from './types';
import { ServiceError } from './types';
import { connectionConfig, type ConnectionConfig } from './connection-config';

export async function createFirebaseAuth(config: ConnectionConfig = connectionConfig(import.meta.env, import.meta.env.DEV)): Promise<AuthDriver> {
  const auth = getAuth(initializeApp(config.firebase));
  if (config.emulatorUrl) connectAuthEmulator(auth, config.emulatorUrl, { disableWarnings: true });
  // Restore the explicit session/personal-device choice; do not persist private app records here.
  let redirectError: Error | null = null;
  await getRedirectResult(auth).catch(error => { redirectError = error; });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return {
    subscribe: (listener, onError) => onAuthStateChanged(auth, (user) => {
      if (redirectError && !user) { const error = redirectError; redirectError = null; onError(error); return; }
      listener(user ? { uid: user.uid, displayName: user.displayName ?? 'Student' } : null);
    }, onError),
    signIn: async ({ remember, redirect }) => {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      if (redirect) await signInWithRedirect(auth, provider);
      else await signInWithPopup(auth, provider);
    },
    signOut: () => signOut(auth),
    getIdToken: async (forceRefresh) => {
      if (!auth.currentUser) throw new ServiceError('Please sign in to continue.', 401);
      return auth.currentUser.getIdToken(forceRefresh);
    },
  };
}
