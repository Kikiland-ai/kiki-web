import './assessment.css';
import { useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { useSession } from '../../app/Session';
import { useAssessmentState } from './AssessmentState';
import type { AssessmentRun, QuizResult } from '../../contracts/api';
import { ASSESSMENT_CONCEPTS } from '../../contracts/assessment-catalog';
import { sameResponses, checkResultForRun } from '../../contracts/assessment';
import { readableError } from '../../services/types';
import { ActionLink, Alert, Button, Card, Icon, LoadingNotice, PageTitle } from '../../ui/kit';
import { ResultView } from './ResultView';

type Language = 'or' | 'en' | 'both';
export function RunCheck() {
  const { assessmentId = '', runId = '' } = useParams(); const { profile, services } = useSession(); const { refresh } = useAssessmentState(); const navigate = useNavigate();
  const [run, setRun] = useState<AssessmentRun | null>(null), [result, setResult] = useState<QuizResult | null>(null);
  const [draft, setDraft] = useState<AssessmentRun['responses']>([]), [index, setIndex] = useState(0), [dirty, setDirty] = useState(false);
  const [language, setLanguage] = useState<Language>(profile?.supportLanguage === 'or' ? 'both' : 'en');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const questionHeading = useRef<HTMLHeadingElement>(null), lastQuestion = useRef('');
  const answerFocus = useRef<{ element: HTMLInputElement; questionId: string } | null>(null);
  const operation = useRef<AbortController | null>(null), submitKey = useRef(crypto.randomUUID());
  const blocker = useBlocker(Boolean(run && run.status === 'in_progress' && !result));
  useEffect(() => {
    const controller = new AbortController(); lastQuestion.current = ''; setLoading(true); setError(''); setRun(null); setResult(null); setDirty(false);
    services.assessments.get(runId, controller.signal).then(async next => {
      if (controller.signal.aborted) return;
      if (next.ownerLearnerId !== profile?.id || next.assessmentId !== assessmentId) throw new Error('Wrong assigned attempt.');
      let completed: QuizResult | null = null;
      if (next.status === 'submitted') {
        completed = await services.assessments.getResult(runId, controller.signal);
        checkResultForRun(next, completed);
      }
      if (controller.signal.aborted) return;
      setRun(next); setDraft(next.responses); setIndex(next.currentQuestionIndex); setResult(completed);
    }).catch(e => { if (!controller.signal.aborted) setError(readableError(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const unregister = services.auth.registerSignOutCleanup(() => { controller.abort(); operation.current?.abort(); });
    return () => { controller.abort(); operation.current?.abort(); unregister(); };
  }, [runId, assessmentId, profile?.id, services, reload]);
  useEffect(() => { if (result && blocker.state === 'blocked') blocker.proceed(); }, [result, blocker]);
  useEffect(() => {
    if (!run || result) return;
    const key = `${run.runId}:${index}`;
    if (lastQuestion.current && lastQuestion.current !== key) { questionHeading.current?.focus(); questionHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }
    lastQuestion.current = key;
  }, [run, index, result]);
  useEffect(() => {
    if (busy || !answerFocus.current) return;
    const pending = answerFocus.current; answerFocus.current = null;
    // The disabled fieldset drops native focus while saving. Restore only the
    // same answer, and only if the learner has not focused another control.
    if (pending.element.isConnected && run?.questions[index].questionId === pending.questionId && document.activeElement === document.body) pending.element.focus();
  }, [busy, run, index]);
  const save = async (responses: AssessmentRun['responses'], position = index) => {
    if (!run || operation.current) return false;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError(''); setDirty(true);
    try {
      const next = await services.assessments.saveDraft(runId, { responses, currentQuestionIndex: position, expectedRevision: run.revision }, controller.signal, `draft-${runId}-${run.revision}`);
      if (controller.signal.aborted) return false;
      if (next.ownerLearnerId !== profile?.id || next.runId !== runId || next.assessmentId !== assessmentId || next.contentVersion !== run.contentVersion || !sameResponses(next.responses, responses)) throw new Error('Draft was not confirmed.');
      setRun(next); setDraft(next.responses); setIndex(next.currentQuestionIndex); setDirty(false); return true;
    } catch(e) { if (!controller.signal.aborted) setError(readableError(e)); return false; }
    finally { if (operation.current === controller) { operation.current = null; if (!controller.signal.aborted) setBusy(false); } }
  };
  const submit = async () => {
    if (!run || operation.current || dirty || draft.length !== run.questions.length) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError('');
    try {
      const next = await services.assessments.submit(runId, { responses: draft }, controller.signal, submitKey.current);
      if (controller.signal.aborted) return;
      checkResultForRun(run, next);
      setResult(next); void refresh();
    } catch(e) { if (!controller.signal.aborted) setError(readableError(e)); }
    finally { if (operation.current === controller) { operation.current = null; if (!controller.signal.aborted) setBusy(false); } }
  };
  if (loading) return <LoadingNotice>Opening your saved check…</LoadingNotice>;
  if (!run) return <div className="page-stack"><PageTitle title="This attempt couldn’t open." />{error && <Alert>{error}</Alert>}<Button onClick={() => setReload(n => n+1)}>Retry opening</Button><ActionLink variant="secondary" to="/practice">Concept checks</ActionLink></div>;
  if (result) return <ResultView run={run} result={result} />;
  const question = run.questions[index], selected = draft.find(r => r.questionId === question.questionId)?.optionIndex;
  const title = run.scope === 'chapter' ? 'Analog Modulation chapter test' : ASSESSMENT_CONCEPTS.find(c => c.assessmentId === assessmentId)?.title ?? 'Concept check';
  return <div className="page-stack quiz-page"><div className="quiz-heading"><PageTitle eyebrow={`ATTEMPT ${run.attemptNumber} · ${run.scope === 'concept' ? 'CONCEPT CHECK' : 'CHAPTER TEST'}`} title={title}>Pass at {run.scope === 'concept' ? '3/5 (60%)' : '8/10 (80%)'}. Questions and option meanings stay the same in either language.</PageTitle><Button variant="secondary" onClick={() => navigate('/practice')}>Pause and leave<Icon name="pause" /></Button></div>{services.mode === 'fixture' && <p className="helper-note">Preview scoring · draft bilingual wording · retries repeat the current sample bank. No real proficiency is certified.</p>}<div className="quiz-controls"><div className="language-switch" role="group" aria-label="Question language">{([{key:'both', label:'Odia + English'}, {key:'or',label:'Odia'}, {key:'en',label:'English'}] as const).map(l => <Button key={l.key} variant="secondary" aria-pressed={language === l.key} onClick={() => setLanguage(l.key)}>{l.label}</Button>)}</div><span role="status" className="draft-status">{busy ? 'Saving…' : dirty ? 'Choice not saved yet' : 'Draft saved'} · {draft.length}/{run.questions.length} answered</span></div>{error && <Alert>{error}<Button variant="text" disabled={busy} onClick={() => save(draft)}>Retry saving choice</Button><Button variant="text" disabled={busy} onClick={() => setReload(n => n+1)}>Reopen saved draft</Button></Alert>}
    <div className="quiz-workbench"><aside className="quiz-outline" aria-label="Check progress"><span className="eyebrow">YOUR CHECK</span><h2>{draft.length} of {run.questions.length} answered</h2><progress value={draft.length} max={run.questions.length} aria-label="Questions answered" /><p>Jump to any question. A tick marks an answer you’ve chosen.</p><div className="question-index" role="group" aria-label="Questions">{run.questions.map((q,i) => <Button key={q.questionId} variant="secondary" className={i === index ? 'current-question' : ''} aria-current={i === index ? 'step' : undefined} disabled={busy} aria-label={`Question ${i+1}${draft.some(r => r.questionId === q.questionId) ? ', answered' : ', unanswered'}`} onClick={() => save(draft,i)}>{i+1}{draft.some(r => r.questionId === q.questionId) && <Icon name="check" />}</Button>)}</div></aside>
    <Card className="question-card"><span className="eyebrow">QUESTION {index+1} OF {run.questions.length}</span><h2 ref={questionHeading} tabIndex={-1}>{language === 'or' ? <span lang="or">{question.prompt.or}</span> : question.prompt.en}</h2>{language === 'both' && <p className="question-odia" lang="or">{question.prompt.or}</p>}<fieldset className="quiz-options" disabled={busy}><legend className="sr-only">Choose one answer for question {index+1}</legend>{question.options.en.map((option,i) => <label key={i} className={`quiz-option ${selected === i ? 'selected' : ''}`}><input type="radio" name={`choice-${question.questionId}`} checked={selected === i} onChange={e => {
      answerFocus.current = { element: e.currentTarget, questionId: question.questionId };
      const next = [...draft.filter(r => r.questionId !== question.questionId), { questionId: question.questionId, optionIndex:i }]; setDraft(next); void save(next);
    }} /><span><strong>{language === 'or' ? <span lang="or">{question.options.or[i]}</span> : option}</strong>{language === 'both' && <span lang="or">{question.options.or[i]}</span>}</span><span className="option-letter" aria-hidden="true">{String.fromCharCode(65+i)}</span></label>)}</fieldset><div className="question-actions"><Button variant="secondary" disabled={busy || index === 0} onClick={() => save(draft,index-1)}><Icon name="arrow_back" />Back</Button>{index < run.questions.length-1 ? <Button disabled={busy} onClick={() => save(draft,index+1)}>Next question<Icon name="arrow_forward" /></Button> : <Button disabled={busy || dirty || draft.length !== run.questions.length} onClick={submit}>{busy ? 'Submitting…' : 'Submit check'}<Icon name="check" /></Button>}</div>{draft.length !== run.questions.length && index === run.questions.length-1 && <p className="helper-note">Answer all {run.questions.length} questions before submitting. Unanswered questions are shown above.</p>}<p className="helper-note">Saved answers survive refresh. A choice marked “not saved” is still only on this page; retry saving before leaving.</p></Card></div>
    {blocker.state === 'blocked' && <LeaveCheck busy={busy} error={error} stay={() => blocker.reset()} leave={async () => { if (!dirty || await save(draft)) { void refresh(); blocker.proceed(); } }} />}
  </div>;
}
function LeaveCheck({ busy, error, stay, leave }: { busy: boolean; error: string; stay(): void; leave(): Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current!; el.showModal(); return () => { el.close(); }; }, []);
  return <dialog ref={dialog} className="leave-dialog" aria-labelledby="leave-title" aria-describedby="leave-description" onCancel={e => { e.preventDefault(); stay(); }}><h2 id="leave-title">Pause this check?</h2><p id="leave-description">Your saved choices will stay with this attempt. Return through Concept checks to resume.</p>{error && <Alert>{error}</Alert>}<div className="form-actions"><Button variant="secondary" disabled={busy} onClick={stay}>Stay in check</Button><Button disabled={busy} onClick={leave}>Save and leave</Button></div></dialog>;
}
