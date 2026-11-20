import { useCallback, useEffect, useRef, useState } from 'react';
import type { TurnView, TutorApi } from '../../contracts/tutor';
import { readableError } from '../../services/types';
import { createPlayer, startMic } from './voice/audio';
import { LiveVoice, type VoiceBrief } from './voice/live-client';

export type VoiceStatus = 'off' | 'connecting' | 'kiki' | 'listening' | 'thinking' | 'reconnecting' | 'error';
export const MAX_RESUMES = 3;

/** Development builds only: a record of the voice run (KiKi's audio and both transcripts) for review. */
type VoiceRecord = { audio: Int16Array[]; kiki: string[]; student: string[]; turns: number };
function devRecord(): VoiceRecord | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const w = window as unknown as { __kikiVoice?: VoiceRecord };
  return (w.__kikiVoice ??= { audio: [], kiki: [], student: [], turns: 0 });
}

export function voiceBrief(v: TurnView): VoiceBrief {
  const b = v.brief;
  return { mode: b.mode, lang: b.lang, say: b.say, expectsReply: b.expectsReply,
    ...(b.goal ? { goal: b.goal } : {}), ...(b.mustNotReveal ? { mustNotReveal: b.mustNotReveal } : {}),
    ...(b.studentSaid !== undefined ? { studentSaid: b.studentSaid } : {}) };
}

/** Plain-language reasons the student can act on. */
export function voiceErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The microphone is blocked. Allow it in your browser’s site settings, or keep going by typing.';
  if (name === 'NotFoundError') return 'No microphone was found. Plug one in, or keep going by typing.';
  if (name === 'NotReadableError') return 'Another app is using the microphone. Close it, or keep going by typing.';
  return readableError(e);
}

/** Resume after a drop only when Live gave us a handle, the close was not a policy refusal, and we have tries left. */
export function shouldResume(recoverable: boolean, resumes: number, active: boolean) {
  return active && recoverable && resumes < MAX_RESUMES;
}

/**
 * Voice on top of the same session. Live hears the student and calls submit_reply; we send
 * the words to the tutor API (the decision service) and hand Live the brief it returns.
 * Drops resume with a fresh token and Live's session handle; anything else falls back to text.
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
  const resumes = useRef(0);
  const active = useRef(false);
  const resumeRef = useRef<() => Promise<void>>(async () => {});   // set below; Live callbacks call through it
  const lastReply = useRef<{ key: string; at: number; brief: VoiceBrief } | null>(null);
  const optsRef = useRef(opts); optsRef.current = opts;

  const stop = useCallback(async (message = '') => {
    active.current = false;
    live.current?.close(); live.current = null;
    await mic.current?.stop().catch(() => undefined); mic.current = null;
    await player.current?.close().catch(() => undefined); player.current = null;
    setStatus(message ? 'error' : 'off'); setError(message); setCaption('');
  }, []);

  const connect = useCallback(async (handle: string | null, prefetched?: { token: string; model: string }) => {
    const { api, view } = optsRef.current;
    if (!api || !view) return;
    const token = prefetched ?? await api.voiceToken(view.sessionId);
    const resuming = !!handle;
    const client: LiveVoice = new LiveVoice({
      ready: () => {
        if (resuming) { setStatus('listening'); return; }     // a resumed session already has its context
        client.speak(voiceBrief(optsRef.current.view!)); setStatus('kiki');
      },
      audio: (pcm) => { devRecord()?.audio.push(pcm); player.current?.play(pcm); setStatus('kiki'); },
      kikiText: (t) => optsRef.current.onProgress(t.length),
      studentText: (t) => setCaption(t),
      reply: async (heard) => {
        // Live occasionally calls submit_reply twice for one utterance: answer the repeat from the last brief
        const key = heard.trim().toLowerCase();
        if (lastReply.current && lastReply.current.key === key && Date.now() - lastReply.current.at < 6000) {
          return lastReply.current.brief;
        }
        const rec = devRecord();
        if (rec) { rec.student.push(heard); rec.turns += 1; }
        setStatus('thinking'); setCaption('');
        const next = await optsRef.current.onTurn(heard);
        const lang = optsRef.current.view?.lang ?? 'en';
        if (!next) return { mode: 'scripted', lang, say: lang === 'or' ? 'କ୍ଷମା କରନ୍ତୁ, ମୁଁ ଠିକ ଶୁଣିପାରିଲି ନାହିଁ। ଆଉ ଥରେ କହିବେ କି?' : 'Sorry, I could not hear that properly. Could you say it again?', expectsReply: true };
        if (next.done) window.setTimeout(() => void stop(), 12000);
        const brief = voiceBrief(next);
        lastReply.current = { key, at: Date.now(), brief };
        return brief;
      },
      turnDone: (said) => {
        if (said) devRecord()?.kiki.push(said);
        optsRef.current.onProgress(Number.MAX_SAFE_INTEGER, true);
        const v = optsRef.current.view;
        if (said && v && !v.done) void api.speech(v.sessionId, said).catch(() => undefined);
      },
      interrupted: () => { player.current?.flush(); setStatus('listening'); },
      goAway: () => { void resumeRef.current(); },
      closed: (reason, recoverable) => {
        if (shouldResume(recoverable, resumes.current, active.current)) void resumeRef.current();
        else void stop(`Voice stopped (${reason}). You can keep going by typing.`);
      },
    });
    const old = live.current;
    live.current = client;
    old?.close();
    client.connect(token.token, token.model, handle);
  }, [stop]);

  const resume = useCallback(async () => {
    const handle = live.current?.handle ?? null;
    if (!handle || !shouldResume(true, resumes.current, active.current)) {
      await stop('Voice was interrupted. You can keep going by typing, or turn voice on again.');
      return;
    }
    resumes.current += 1;
    setStatus('reconnecting');
    try { await connect(handle); }
    catch (e) { await stop(voiceErrorMessage(e)); }
  }, [connect, stop]);
  useEffect(() => { resumeRef.current = resume; }, [resume]);

  const start = useCallback(async () => {
    const { api, view } = optsRef.current;
    if (!api || !view || view.done) return;
    setStatus('connecting'); setError(''); resumes.current = 0; active.current = true;
    try {
      // availability first (no mic prompt when voice is off), then the mic, then the socket
      const token = await api.voiceToken(view.sessionId);
      mic.current = await startMic((pcm) => live.current?.sendAudio(pcm));
      player.current = createPlayer(() => setStatus(s => (s === 'kiki' ? 'listening' : s)));
      await connect(null, token);
    } catch (e) {
      await stop(voiceErrorMessage(e));
    }
  }, [connect, stop]);

  useEffect(() => () => { void stop(); }, [stop]);
  return { status, caption, error, start, stop: () => stop() };
}
