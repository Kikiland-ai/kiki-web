import { useEffect, useState } from 'react';
import type { TutorApi } from '../../contracts/tutor';
import { useSession } from '../../app/Session';

// One health check per API client for the whole app session.
const cache = new WeakMap<TutorApi, Promise<boolean>>();

export function tutorAvailable(api: TutorApi | undefined): Promise<boolean> {
  if (!api) return Promise.resolve(false);
  let p = cache.get(api);
  if (!p) {
    p = api.health().then(h => h.enabled).catch(() => false);
    cache.set(api, p);
  }
  return p;
}

/**
 * Whether to offer tutor mode at all. The API ships with tutor mode off until it is switched on
 * (KIKI_TUTOR_ENABLED), so entry points stay hidden until `/tutor/health` says it is enabled.
 */
export function useTutorAvailable(): boolean {
  const { services } = useSession();
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void tutorAvailable(services.tutor).then(v => { if (live) setOn(v); });
    return () => { live = false; };
  }, [services.tutor]);
  return on;
}
