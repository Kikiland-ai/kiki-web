import { useCallback, useEffect, useRef, useState } from 'react';
import type { LText, Report, TurnInput, TurnView, TutorApi } from '../../contracts/tutor';
import { readableError } from '../../services/types';
import { dueItems, planReveals, textModeDelays, type PlannedReveal } from './reveal';

export type Entry = { who: 'kiki' | 'you'; text: string; kind?: string; lang?: 'en' | 'or' };
const keyName = (qid: string, lang: string) => `kiki.tutor.session-key.${qid}.${lang}`;

function storedKey(qid: string, lang: string, fresh = false) {
  try {
    const name = keyName(qid, lang);
    if (!fresh) { const k = sessionStorage.getItem(name); if (k) return k; }
    const k = crypto.randomUUID();
    sessionStorage.setItem(name, k);
    return k;
  } catch { return crypto.randomUUID(); }
}

export function kikiLines(view: TurnView): Entry[] {
  return view.brief.segments.filter(s => s.say.trim()).map(s => ({ who: 'kiki' as const, text: s.say, kind: s.kind, lang: view.lang }));
}

/**
 * One tutoring session: the server decides; this hook only shows what it returns.
 * Board items appear on a schedule: a quick stagger in text mode, KiKi's speech in voice mode.
 */
export function useTutorSession(api: TutorApi | undefined, questionId: string, lang: 'en' | 'or') {
  const [view, setView] = useState<TurnView | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const timers = useRef<number[]>([]);
  const pending = useRef<PlannedReveal[]>([]);
  const viewRef = useRef<TurnView | null>(null);

  const reveal = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setShown(prev => { const next = new Set(prev); ids.forEach(i => next.add(i)); return next; });
    setFresh(prev => { const next = new Set(prev); ids.forEach(i => next.add(i)); return next; });   // fresh = everything this turn revealed
  }, []);

  const apply = useCallback((v: TurnView, mode: 'text' | 'voice' | 'resume') => {
    timers.current.forEach(t => window.clearTimeout(t));
    timers.current = [];
    viewRef.current = v;
    setView(v);
    setFresh(new Set());                 // a new turn starts a new set of fresh items
    const newIds = new Set(v.revealed);
    const old = v.board.map(i => i.id).filter(i => !newIds.has(i));
    if (mode === 'resume') { setShown(new Set(v.board.map(i => i.id))); pending.current = []; return; }
    setShown(prev => { const next = new Set(prev); old.forEach(i => next.add(i)); return next; });
    const plan = planReveals(v.brief.segments).filter(p => newIds.has(p.item));
    const planned = new Set(plan.map(p => p.item));
    reveal(v.revealed.filter(i => !planned.has(i)));   // anything without an anchor shows at once
    if (mode === 'voice') { pending.current = plan; return; }
    pending.current = [];
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const { item, ms } of textModeDelays(plan, v.brief.say.length)) {
      if (reduce || ms === 0) reveal([item]);
      else timers.current.push(window.setTimeout(() => reveal([item]), ms));
    }
  }, [reveal]);

  /** Voice mode: KiKi has spoken `chars` characters of the current brief. */
  const spokenProgress = useCallback((chars: number, finished = false) => {
    const v = viewRef.current;
    if (!v || !pending.current.length) return;
    const due = finished ? pending.current.map(p => p.item) : dueItems(pending.current, chars);
    if (!due.length) return;
    pending.current = pending.current.filter(p => !due.includes(p.item));
    reveal(due);
  }, [reveal]);

  const start = useCallback(async (restart = false) => {
    if (!api) return;
    setBusy(true); setError(''); setReport(null);
    try {
      const v = await api.start(questionId, lang, storedKey(questionId, lang, restart));
      const resumed = v.turn > 0;
      setHistory(resumed ? [{ who: 'kiki', text: 'Welcome back. Here is where we were:', kind: 'note' }, ...kikiLines(v)] : kikiLines(v));
      setShown(new Set());
      apply(v, resumed ? 'resume' : 'text');
    } catch (e) { setError(readableError(e)); }
    finally { setBusy(false); }
  }, [api, questionId, lang, apply]);

  const send = useCallback(async (input: TurnInput, shownText: string, mode: 'text' | 'voice' = 'text') => {
    const v = viewRef.current;
    if (!api || !v || v.done) return null;
    setBusy(true); setError('');
    setHistory(h => [...h, { who: 'you', text: shownText }]);
    try {
      const next = await api.turn(v.sessionId, input, crypto.randomUUID());
      setHistory(h => [...h, ...kikiLines(next)]);
      apply(next, mode);
      return next;
    } catch (e) {
      setError(readableError(e));
      return null;
    } finally { setBusy(false); }
  }, [api, apply]);

  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);

  useEffect(() => {
    if (!api || !view?.done || report) return;
    let live = true;
    api.report(view.sessionId).then(r => { if (live) setReport(r); }).catch(e => { if (live) setError(readableError(e)); });
    return () => { live = false; };
  }, [api, view?.done, view?.sessionId, report]);

  return { view, history, shown, fresh, busy, error, report, start, send, spokenProgress, setError };
}

export const pickText = (t: LText, lang: 'en' | 'or') => (lang === 'or' && t.or) || t.en;
