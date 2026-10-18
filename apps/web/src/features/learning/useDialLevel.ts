import { useEffect, useRef, useState } from 'react';
import type { DialLevel } from '../../contracts/profile';
import { useSession } from '../../app/Session';
import { readableError } from '../../services/types';

/** Save through the SAME validated profile used by onboarding/Profile. Latest choice wins. */
export function useDialLevel() {
  const { profile, update } = useSession();
  const [dial, setValue] = useState<DialLevel>(profile?.dialLevel ?? 2);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const active = useRef(true), revision = useRef(0), queue = useRef(Promise.resolve());
  const current = useRef(profile); current.current = profile;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function setDial(next: DialLevel) {
    const uid = current.current?.id, attempt = ++revision.current;
    setValue(next); setSaving(true); setError('');
    queue.current = queue.current.catch(() => undefined).then(async () => {
      if (!active.current || attempt !== revision.current) return;
      // Signed out or another account: nothing to save to, so stop showing "Saving…"
      if (!uid || current.current?.id !== uid) { setSaving(false); return; }
      const saved = current.current;
      try {
        await update({ supportLanguage: saved.supportLanguage, onboarding: saved.onboarding, dialLevel: next });
        if (active.current && attempt === revision.current) { setSaving(false); }
      } catch (e) {
        if (active.current && attempt === revision.current) { setError(readableError(e)); setSaving(false); }
      }
    });
  }
  return { dial: profile?.supportLanguage === 'en' ? 5 as DialLevel : dial, setDial, saving, error, retry: () => setDial(dial) };
}
