import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../../app/Session';
import { COURSE } from '../../contracts/profile';
import type { AssessmentOverview } from '../../contracts/assessment';
import { readableError } from '../../services/types';

const Context = createContext<{ overview: AssessmentOverview | null; loading: boolean; error: string; refresh(): Promise<void> } | null>(null);
export function AssessmentProvider({ children }: { children: ReactNode }) {
  const { profile, services } = useSession(); const uid = profile?.id;
  const [overview, setOverview] = useState<AssessmentOverview | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const read = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!uid) return;
    read.current?.abort(); const controller = new AbortController(); read.current = controller; setLoading(true); setError('');
    try {
      const next = await services.assessments.overview(COURSE.chapterId, controller.signal);
      if (controller.signal.aborted) return;
      if (next.ownerLearnerId !== uid || next.planId !== COURSE.chapterId) throw new Error('Assessment owner or chapter mismatch.');
      setOverview(next);
    } catch (e) { if (!controller.signal.aborted) setError(readableError(e)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [uid, services]);
  useEffect(() => {
    setOverview(null); setError('');
    if (!uid) { setLoading(false); return; }
    void refresh();
    const unregister = services.auth.registerSignOutCleanup(() => { read.current?.abort(); });
    return () => { read.current?.abort(); unregister(); };
  }, [uid, refresh, services]);
  return <Context.Provider value={{ overview, loading, error, refresh }}>{children}</Context.Provider>;
}
export function useAssessmentState() { const value = useContext(Context); if (!value) throw new Error('Assessment provider missing.'); return value; }
