import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Profile, ProfileUpdate } from '../contracts/profile';
import type { Identity, Services } from '../services/types';
import { readableError, ServiceError } from '../services/types';

interface SessionValue {
  services: Services; identity: Identity | null; profile: Profile | null;
  status: 'checking' | 'signedout' | 'loading' | 'ready' | 'error'; error: string;
  retry(): void; update(update: ProfileUpdate): Promise<void>;
  enroll(courseId: string, semester: number): Promise<void>; logout(): Promise<void>;
}
const Context = createContext<SessionValue | null>(null);
export function SessionProvider({ services, children }: { services: Services; children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<SessionValue['status']>('checking');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const currentUid = useRef<string | null>(null);
  useEffect(() => {
    let controller: AbortController | undefined;
    let active = true;
    const authDeadline = window.setTimeout(() => {
      if (active) { setError('Checking your sign-in took too long. Please retry.'); setStatus('error'); }
    }, 15000);
    const unsubscribe = services.auth.subscribe((user) => {
      window.clearTimeout(authDeadline);
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      currentUid.current = user?.uid ?? null;
      setIdentity(user); setProfile(null); setError('');
      if (!user) { setStatus('signedout'); return; }
      setStatus('loading');
      services.api.bootstrap(signal).then(next => {
        if (!active || signal.aborted) return;
        if (next.id !== user.uid) throw new ServiceError('The profile does not match your signed-in account. Sign out and try again.');
        setProfile(next); setStatus('ready');
      }).catch(e => {
        if (!active || signal.aborted) return;
        setError(readableError(e)); setStatus('error');
      });
    }, e => { window.clearTimeout(authDeadline); if (active) { currentUid.current = null; setIdentity(null); setProfile(null); setError(readableError(e)); setStatus('error'); } });
    return () => { active = false; window.clearTimeout(authDeadline); controller?.abort(); unsubscribe(); };
  }, [services, revision]);
  const apply = useCallback((next: Profile, expectedUid: string | null) => {
    if (!expectedUid || currentUid.current !== expectedUid) throw new ServiceError('Your account changed. Please reopen this page.');
    if (next.id !== expectedUid) throw new ServiceError('The saved profile does not match your account.');
    setProfile(next);
  }, []);
  const update = async (body: ProfileUpdate) => { const uid = currentUid.current; apply(await services.api.updateProfile(body), uid); };
  const enroll = async (id: string, semester: number) => { const uid = currentUid.current; apply(await services.api.enroll(id, semester), uid); };
  const logout = async () => {
    // Clearing the provider immediately unmounts protected screens and their component drafts.
    currentUid.current = null; setProfile(null); setIdentity(null); setStatus('checking'); setError('');
    sessionStorage.removeItem('kiki:return:v1');
    try { await services.auth.signOut(); setStatus('signedout'); }
    catch (e) { setError(readableError(e)); setStatus('error'); throw e; }
  };
  return <Context.Provider value={{ services, identity, profile, status, error, update, enroll, logout, retry: () => setRevision(n => n + 1) }}>{children}</Context.Provider>;
}
export function useSession() { const value = useContext(Context); if (!value) throw new Error('Session provider is missing.'); return value; }
