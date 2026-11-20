import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PhysicalLabNarrationManifest } from '../../../contracts/lab-narration';
import type { PhysicalLabApi, PhysicalSession } from '../../../contracts/physical-lab';
import { StepNarrationPlayer } from '../lab-narration';

type Player = StepNarrationPlayer<PhysicalLabNarrationManifest, PhysicalSession>;

export function usePhysicalNarration(
  api: PhysicalLabApi['narration'],
  session: PhysicalSession,
  registerCleanup?: (cleanup: () => void) => () => void,
) {
  const sessionId = session.session_id;
  const player = useRef<Player | null>(null);
  const [view, setView] = useState<ReturnType<Player['view']>>();

  useEffect(() => {
    if (!api) return;
    const next: Player = new StepNarrationPlayer(sessionId, api, () => setView(next.view()), (state, manifest) => {
      const step = state?.activity.step;
      if (!step || state.mode !== 'experiment_demo' || (state.stage !== 'rehearsal' && state.stage !== 'observations')) return {key: null};
      const key = `${state.session_id}:${step.id}`;
      if (!manifest || manifest.experimentId !== state.experiment_id || manifest.mode !== state.mode
        || manifest.packVersion !== state.pack_version || manifest.packSha256 !== state.pack_sha256) return {key};
      return {key, clip: manifest.clips[step.id]};
    });
    player.current = next;
    setView(next.view());
    const stop = () => {
      next.dispose();
      if (player.current === next) player.current = null;
    };
    const unregister = registerCleanup?.(stop);
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      unregister?.();
      stop();
    };
  }, [api, sessionId, registerCleanup]);

  // The committed guide, rather than a submitted event, owns the spoken step.
  const enabled = view?.enabled;
  useLayoutEffect(() => {
    player.current?.sync(session);
    player.current?.shown(session);
  }, [enabled, session]);

  return {
    view: api ? view : undefined,
    toggle: () => { void player.current?.toggle(); },
    replay: () => { player.current?.replay(); },
  };
}
