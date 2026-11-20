import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../learning/useMediaQuery';
import { Link, useParams } from 'react-router';
import { useSession } from '../../app/Session';
import type { QuestionView } from '../../contracts/tutor';
import { readableError } from '../../services/types';
import { Button, ErrorState, Kiki, LoadingState, StatusBadge } from '../../ui/learning';
import { Report } from './Report';
import { useTutorSession, pickText } from './useTutorSession';
import { useVoice } from './useVoice';
import { Whiteboard } from './Whiteboard';
import styles from './Tutor.module.css';

const VOICE_LABEL = { off: '', connecting: 'Connecting voice…', kiki: 'KiKi is speaking', listening: 'Listening — answer out loud', thinking: 'KiKi is thinking…', reconnecting: 'Reconnecting voice…', error: '' } as const;

export function TutorScreen() {
  const { conceptId = '', questionId = '' } = useParams();
  const { services, profile } = useSession();
  const api = services.tutor;
  const [lang, setLang] = useState<'en' | 'or'>(profile?.supportLanguage === 'en' || (profile?.dialLevel ?? 2) >= 4 ? 'en' : 'or');
  const [question, setQuestion] = useState<QuestionView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [started, setStarted] = useState(false);
  const [draft, setDraft] = useState('');
  const s = useTutorSession(api, questionId, lang);
  const voice = useVoice({
    api, view: s.view,
    onTurn: (heard) => s.send({ text: heard, mode: 'voice' }, heard, 'voice'),
    onProgress: s.spokenProgress,
  });
  const logEnd = useRef<HTMLLIElement>(null);
  // narrow screens: the conversation docks to the bottom of the viewport. It is portalled to <body>
  // so no app-shell ancestor (transforms, containment) can turn `position: fixed` into page flow.
  const docked = useMediaQuery('(max-width: 860px)');
  const dock = (node: ReactNode) => (docked && typeof document !== 'undefined' ? createPortal(node, document.body) : node);

  useEffect(() => {
    if (!api) return;
    const ctl = new AbortController();
    api.question(questionId, ctl.signal).then(setQuestion).catch(e => { if (!ctl.signal.aborted) setLoadError(readableError(e)); });
    return () => ctl.abort();
  }, [api, questionId]);
  useEffect(() => { logEnd.current?.scrollIntoView?.({ block: 'nearest' }); }, [s.history.length]);

  if (!api) return <ErrorState message="Tutor mode is not available here." />;
  if (loadError) return <ErrorState message={loadError} />;
  if (!question) return <LoadingState message="Opening the tutor…" />;

  const view = s.view;
  const draftReview = question.review.languages[lang] === 'draft';
  const stageIndex = view?.stageIndex ?? 0;
  const done = !!view?.done;
  const voiceOn = voice.status !== 'off' && voice.status !== 'error';
  const kikiPose = s.busy || voice.status === 'thinking' ? 'thinking' : voice.status === 'kiki' ? 'speaking' : voice.status === 'listening' ? 'listening' : done ? 'celebrating' : 'asking';

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || s.busy) return;
    setDraft('');
    void s.send({ text }, text);
  }

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <Link to={`/concepts/${conceptId}`} className={styles.back}>← Back to the lesson</Link>
        <h1 lang={lang}>{pickText(question.title, lang)}</h1>
        <div className={styles.badges}>
          <StatusBadge label={question.difficulty === 'hard' ? 'Hard' : 'Medium'} />
          {draftReview && <StatusBadge label={lang === 'or' ? 'Machine draft · Odia not reviewed' : 'Draft content'} />}
        </div>
        <ol className={styles.rail} aria-label="Stages">
          {question.stages.map((st, i) => {
            const state = done || i < stageIndex ? 'done' : i === stageIndex && started ? 'now' : 'later';
            return <li key={st.id} data-state={state} aria-current={state === 'now' ? 'step' : undefined}><span>{i + 1}</span>{pickText(st.title, lang)}</li>;
          })}
        </ol>
      </header>

      {!started ? (
        <section className={styles.intro}>
          <Kiki state="asking" size={72} label="" />
          <div>
            <p>KiKi will ask you a few short questions, one stage at a time. Answer in your own words — by voice or by typing. The board fills in as you work it out.</p>
            <fieldset className={styles.langPick}>
              <legend>Talk in</legend>
              <label><input type="radio" name="tutor-lang" checked={lang === 'or'} onChange={() => setLang('or')} disabled={!question.languages.includes('or')} /> ଓଡ଼ିଆ (Odia)</label>
              <label><input type="radio" name="tutor-lang" checked={lang === 'en'} onChange={() => setLang('en')} /> English</label>
            </fieldset>
            <Button onClick={() => { setStarted(true); void s.start(); }}>Start talking it through</Button>
          </div>
        </section>
      ) : done && s.report ? null : (
        <div className={styles.layout}>
          <Whiteboard items={view?.board ?? []} shown={s.shown} fresh={s.fresh} lang={lang}
            stages={question.stages} currentStage={done ? question.stages.length : stageIndex}
            focus={view?.brief.segments.flatMap(seg => seg.focus) ?? []} />
          {dock(<section className={styles.talk} aria-label="Conversation with KiKi">
            <div className={styles.kikiRow}>
              <Kiki state={kikiPose} size={48} label="" />
              <span role="status" className={styles.voiceStatus}>{s.busy ? 'KiKi is thinking…' : VOICE_LABEL[voice.status]}</span>
            </div>
            <ol className={styles.log}>
              {s.history.map((h, i) => (
                <li key={i} className={h.who === 'kiki' ? styles.kikiLine : styles.youLine} data-kind={h.kind} lang={h.who === 'kiki' ? h.lang : undefined}>
                  <span className={styles.who}>{h.who === 'kiki' ? 'KiKi' : 'You'}</span>{h.text}
                </li>
              ))}
              {voice.caption && <li className={styles.youLine} aria-live="polite"><span className={styles.who}>You (hearing)</span>{voice.caption}</li>}
              <li ref={logEnd} aria-hidden="true" />
            </ol>
            {(s.error || voice.error) && <p role="alert" className={styles.alert}>{s.error || voice.error}</p>}
            {!done && view && (
              <>
                {!!view.chips.length && (
                  <div className={styles.chips} role="group" aria-label="Quick replies">
                    {view.chips.map(c => (
                      <Button key={c.route} data-route={c.route} variant="secondary" disabled={s.busy || voiceOn}
                        onClick={() => void s.send({ chip: c.route }, pickText(c.label, lang))}>
                        <span lang={lang === 'or' && c.label.or ? 'or' : 'en'}>{pickText(c.label, lang)}</span>
                      </Button>
                    ))}
                  </div>
                )}
                <form className={styles.reply} onSubmit={submit}>
                  <label htmlFor="tutor-reply" className={styles.srOnly}>Your answer</label>
                  <textarea id="tutor-reply" value={draft} rows={2} maxLength={2000} placeholder="Type your answer, in Odia or English…"
                    onChange={e => setDraft(e.target.value)} disabled={s.busy || voiceOn}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(e as unknown as FormEvent); }} />
                  <Button type="submit" disabled={s.busy || voiceOn || !draft.trim()}>Send</Button>
                </form>
                <div className={styles.voiceRow}>
                  {voiceOn
                    ? <Button variant="secondary" onClick={() => void voice.stop()}>Stop voice</Button>
                    : <Button variant="secondary" onClick={() => void voice.start()} disabled={s.busy}>Talk by voice</Button>}
                </div>
              </>
            )}
          </section>)}
        </div>
      )}
      {done && s.report && <Report report={s.report} question={question} lang={lang} onRestart={() => void s.start(true)} />}
      {done && !s.report && !s.error && <LoadingState message="Preparing your scorecard…" />}
    </main>
  );
}
