import { useState } from 'react';
import type { ResponseKind } from '../../contracts/lab-execution';
import { readableError } from '../../services/types';
import { Button } from '../../ui/kit';
import { currentScope } from './floating-guidance';
import type { LabCaptureController, LabCaptureView } from './lab-capture';
import styles from './LabConnection.module.css';

type Draft = { text: string; kind: ResponseKind; confidence: string; note: string; selected: string[] };
const blank = (): Draft => ({ text: '', kind: 'observation', confidence: '', note: '', selected: [] });

/** Drafts live only in this preparation's mounted UI. They are never auto-submitted. */
export function LabStudentInput({ view, submitInput, retryRequirements, declareCondition }: { view: LabCaptureView; submitInput: LabCaptureController['submitInput']; retryRequirements(): void; declareCondition?: LabCaptureController['declareCondition'] }) {
  const state = view.state!;
  const scope = JSON.stringify(currentScope(state));
  const [draftScope, setDraftScope] = useState(scope);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({ [scope]: blank() });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const draft = drafts[draftScope];
  const stale = scope !== draftScope;
  const checkpoint = view.requirements?.checkpoints.find(cp => cp.id === state.queue.current_checkpoint_id);
  const steps = Array.isArray(state.steps) ? state.steps : Object.values(state.steps);
  const step = steps.find(s => s.checkpoint_id === state.queue.current_checkpoint_id);
  const criterionState = (id: string) => step?.criteria?.find(c => c.criterion_id === id);
  const requirementsMatch = view.requirements?.definitionSha256 === state.definition?.definition_sha256 && view.requirements?.backendLabId === state.lab_session_id;
  const disabled = stale || submitting || view.inputBusy || !checkpoint || !requirementsMatch || state.status === 'completed';
  const fresh = view.phase === 'active' && view.snapshot?.screen_context.status === 'fresh' && state.runtime.analysis_status === 'available' && state.workspace.condition === checkpoint?.condition;
  const responses = state.responses?.filter(r => r.visit_id === currentScope(state).visit_id && r.checkpoint_id === state.queue.current_checkpoint_id) ?? [];
  const missingResponse = draft.selected.some(id => {
    const kinds = checkpoint?.criteria.find(c => c.id === id)?.responseKinds ?? [];
    return kinds.length && !responses.some(r => kinds.includes(r.kind));
  });
  const update = (patch: Partial<Draft>) => setDrafts(old => ({ ...old, [draftScope]: { ...old[draftScope], ...patch } }));
  const useCurrentStep = () => {
    setDrafts(old => ({ ...old, [scope]: old[scope] ?? blank() }));
    setDraftScope(scope); setMessage('');
  };
  async function submit(review: boolean) {
    if (disabled) return;
    setSubmitting(true); setMessage('');
    const key = draftScope;
    try {
      await submitInput(key, review
        ? { criterion_ids: draft.selected, review_note: draft.note.trim() }
        : { kind: draft.kind, text: draft.text.trim(), ...(draft.confidence ? { self_confidence: Number(draft.confidence) } : {}) });
      setDrafts(old => ({ ...old, [key]: { ...old[key], ...(review ? { selected: [], note: '' } : { text: '' }) } }));
      setMessage(review ? 'Your explicit confirmations were recorded. They are not an assessed proficiency result.' : 'Your response was recorded as a student report, not an assessed answer.');
    } catch (error) { setMessage(readableError(error)); }
    finally { setSubmitting(false); }
  }
  return <div className={styles.studentInput} aria-label="Your lab evidence">
    <h3>Your observations and confirmations</h3>
    <p>Write what you did and observed. Student reports, explicit confirmations and screen inference remain separate from assessed proficiency.</p>
    {message && <p role="status">{message}</p>}
    {stale && <div role="alert"><p>The checkpoint or screen context changed. Your earlier draft is kept and will not be submitted to this step. Choose Use current step to open a separate draft for the current context; it does not copy or submit the earlier draft.</p><Button variant="secondary" disabled={submitting || view.inputBusy} onClick={useCurrentStep}>Use current step</Button></div>}
    {view.requirementsError && <div role="alert"><p>{view.requirementsError}</p><Button variant="secondary" onClick={retryRequirements}>Retry input instructions</Button></div>}
    {!checkpoint && !view.requirementsError && <p role="status">Loading this step’s input instructions…</p>}
    {checkpoint && <>
      <p><strong>{checkpoint.id}</strong> · Expected condition: {checkpoint.condition.replaceAll('_', ' ')}. The server checks the current visit and evidence before recording a confirmation.</p>
      {state.workspace.condition !== checkpoint.condition && <div role="note"><p>The tracker currently records {state.workspace.condition.replaceAll('_', ' ')}. After you set up the intended condition in MATLAB, declare it here and obtain a new screen check. This records your intent; it does not change or verify your model.</p><Button variant="secondary" disabled={disabled || !declareCondition} onClick={() => {
        if (!declareCondition) return;
        setSubmitting(true); setMessage('');
        void declareCondition(draftScope).then(() => setMessage('Intended condition recorded. Obtain a new checked screen before confirming.'), error => setMessage(readableError(error))).finally(() => setSubmitting(false));
      }}>Declare intended {checkpoint.condition.replaceAll('_', ' ')}</Button></div>}
      <form onSubmit={event => { event.preventDefault(); void submit(false); }}>
        <fieldset disabled={disabled}><legend>Your response</legend>
          {checkpoint.responsePrompt && <p>{checkpoint.responsePrompt}</p>}
          <label>Response kind<select value={draft.kind} onChange={event => update({ kind: event.target.value as ResponseKind })}>{(['prediction', 'observation', 'explanation', 'question', 'note'] as const).map(kind => <option key={kind} value={kind}>{kind}</option>)}</select></label>
          <label>Your own words<textarea value={draft.text} onChange={event => update({ text: event.target.value })} minLength={1} maxLength={2000} required rows={4} /></label>
          <label>Confidence (optional)<select value={draft.confidence} onChange={event => update({ confidence: event.target.value })}><option value="">Not supplied</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <Button type="submit" disabled={!draft.text.trim()}>Record response</Button>
        </fieldset>
      </form>
      <form id="kiki-lab-confirmation" tabIndex={-1} aria-label="Current step confirmation" onSubmit={event => { event.preventDefault(); void submit(true); }}>
        <p>Confirm the current step here after reviewing your model. This form records your selections and your own evidence note.</p>
        {['CP-DSB-01', 'CP-DSB-12'].includes(checkpoint.id) && <p>Save your model in MATLAB first. Confirming here records your report of that save; it does not save the MATLAB model or verify the saved file.</p>}
        {stale && <div role="alert"><p>Your earlier draft is kept. Open a separate draft for this context before confirming. Your earlier selections and note will not be copied or submitted.</p><Button variant="secondary" disabled={submitting || view.inputBusy} onClick={useCurrentStep}>Use current step for confirmation</Button></div>}
        <fieldset disabled={disabled}><legend>Confirm evidence you reviewed</legend>
          <p>Select only criteria you personally checked. Nothing is selected automatically.</p>
          {checkpoint.criteria.map(c => {
            const criterion = criterionState(c.id);
            return <label className={styles.criterion} key={c.id}><input type="checkbox" checked={draft.selected.includes(c.id)} onChange={event => update({ selected: event.target.checked ? [...draft.selected, c.id] : draft.selected.filter(id => id !== c.id) })} /><span>{c.description}<small>{criterion?.state === 'satisfied' ? `Recorded · ${criterion.completion_basis?.replaceAll('_', ' ') ?? 'server evidence'}` : 'Not yet confirmed'}{c.responseKinds.length ? ` · This visit needs one of: ${c.responseKinds.join(', ')}` : ''}</small></span></label>;
          })}
          <label>What evidence did you review?<textarea value={draft.note} onChange={event => update({ note: event.target.value })} minLength={8} maxLength={1000} required rows={3} /></label>
          {!fresh && <p>Resume sharing and obtain a fresh checked screen in the expected condition before confirming. The server also verifies that the checked image is still available.</p>}
          {missingResponse && <p>Record the required response for this visit before confirming these criteria.</p>}
          <Button type="submit" disabled={!fresh || !draft.selected.length || draft.note.trim().length < 8 || missingResponse}>Confirm selected criteria</Button>
        </fieldset>
      </form>
      {responses.length > 0 && <details><summary>Your recorded responses for this visit</summary>{responses.map(r => <p key={r.id}><strong>{r.kind} · student report, unassessed:</strong> {r.text}</p>)}</details>}
    </>}
  </div>;
}
