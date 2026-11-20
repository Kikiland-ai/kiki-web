import { useCallback, useEffect, useRef, useState } from 'react';
import type { TurnView, TutorApi } from '../../contracts/tutor';
import { readableError } from '../../services/types';
import { createPlayer, startMic } from './voice/audio';
import { LiveVoice, type VoiceBrief } from './voice/live-client';

export type VoiceStatus = 'off' | 'connecting' | 'kiki' | 'listening' | 'thinking' | 'error';

export function voiceBrief(v: TurnView): VoiceBrief {
  const b = v.brief;
  return { mode: b.mode, lang: b.lang, say: b.say, expectsReply: b.expectsReply,
    ...(b.goal ? { goal: b.goal } : {}), ...(b.mustNotReveal ? { mustNotReveal: b.mustNotReveal } : {}),
    ...(b.studentSaid !== undefined ? { studentSaid: b.studentSaid } : {}) };
}

/**
 * Voice on top of the same session. Live hears the student and calls submit_reply; we send
 * the words to the tutor API (the decision service) and hand Live the brief it returns.
 * Any failure drops back to text: the session itself is unaffected.
 */
export function useVoice(opts: {
  api: TutorApi | undefined; view: TurnView | null;
  onTurn: (heard: string) => Promise<TurnView | null>;
  onProgress: (chars: number, finished?: boolean) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>('off');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const live = useRef<LiveVoice | null>(null);
  const mic = useRef<Awaited<ReturnType<typeof startMic>> | null>(null);
  const player = useRef<ReturnType<typeof createPlayer> | null>(null);
  const optsRef = useRef(opts); optsRef.current = opts;

  const stop = useCallback(async (message = '') => {
    live.current?.close(); live.current = null;
    await mic.current?.stop().catch(() => undefined); mic.current = null;
    await player.current?.close().catch(() => undefined); player.current = null;
    setStatus(message ? 'error' : 'off'); setError(message); setCaption('');
  }, []);

  const start = useCallback(async () => {
    const { api, view } = optsRef.current;
    if (!api || !view || view.done) return;
    setStatus('connecting'); setError('');
    try {
      const token = await api.voiceToken(view.sessionId);
      player.current = createPlayer(() => setStatus(s => (s === 'kiki' ? 'listening' : s)));
      const client = new LiveVoice({
        ready: () => { client.speak(voiceBrief(optsRef.current.view!)); setStatus('kiki'); },
        audio: (pcm) => { player.current?.play(pcm); setStatus('kiki'); },
        kikiText: (t) => optsRef.current.onProgress(t.length),
        studentText: (t) => setCaption(t),
        reply: async (heard) => {
          setStatus('thinking'); setCaption('');
          const next = await optsRef.current.onTurn(heard);
          if (!next) return { mode: 'scripted', lang: view.lang, say: 'Sorry, I could not hear that properly. Could you say it again?', expectsReply: true };
          if (next.done) window.setTimeout(() => void stop(), 12000);
          return voiceBrief(next);
        },
        turnDone: (said) => {
          optsRef.current.onProgress(Number.MAX_SAFE_INTEGER, true);
          const v = optsRef.current.view;
          if (said && v && !v.done) void api.speech(v.sessionId, said).catch(() => undefined);
        },
        interrupted: () => { player.current?.flush(); setStatus('listening'); },
        closed: (reason) => { void stop(`Voice stopped (${reason}). You can keep going by typing.`); },
      });
      live.current = client;
      client.connect(token.token, token.model);
      mic.current = await startMic((pcm) => live.current?.sendAudio(pcm));
    } catch (e) {
      await stop(`${readableError(e)}`);
    }
  }, [stop]);

  useEffect(() => () => { void stop(); }, [stop]);
  return { status, caption, error, start, stop: () => stop() };
}
