// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ExecutionRequirementsSchema, LabExecutionStateSchema } from '../../contracts/lab-execution';
import { ServiceError } from '../../services/types';
import { LabStudentInput } from './LabStudentInput';
import type { LabCaptureView } from './lab-capture';
import { currentScope, projectSnapshot } from './floating-guidance';
import receipt from './__fixtures__/python-execution.json';
import requirements from './__fixtures__/lab-input-requirements.json';

afterEach(cleanup);
function view(checkpoint = 'CP-DSB-01'): LabCaptureView {
  const state = LabExecutionStateSchema.parse(receipt.start);
  state.queue.current_checkpoint_id = checkpoint;
  const snapshot = projectSnapshot(state);
  snapshot.screen_context.status = 'fresh';
  state.runtime.analysis_status = 'available';
  state.workspace.condition = checkpoint === 'CP-DSB-11' ? 'phase_fault' : checkpoint === 'CP-DSB-12' ? 'restored_baseline' : 'baseline';
  return { state, snapshot, requirements: ExecutionRequirementsSchema.parse(requirements), requirementsError: '', phase: 'active', reason: '', extension: { bound: true, present: true, superseded: false }, preview: null, reading: false, retryAfterMs: 0, recovering: false, canRecover: false, inputBusy: false };
}
it.each(['CP-DSB-01', 'CP-DSB-12'])('distinguishes a MATLAB save from a student confirmation at %s', checkpoint => {
  render(<LabStudentInput view={view(checkpoint)} submitInput={vi.fn()} retryRequirements={() => {}} />);
  expect(within(screen.getByRole('form', { name: 'Current step confirmation' })).getByText(/Save your model in MATLAB first/).textContent).toContain('does not save the MATLAB model or verify the saved file');
  expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every(c => !c.checked)).toBe(true);
});
it('offers current-context recovery inside the focused confirmation form without copying old evidence', () => {
  const v = view(), submitInput = vi.fn();
  const ui = render(<LabStudentInput view={v} submitInput={submitInput} retryRequirements={() => {}} />);
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  fireEvent.change(screen.getByLabelText('What evidence did you review?'), { target: { value: 'Earlier student evidence note.' } });
  const changed = { ...v, state: { ...v.state!, workspace: { ...v.state!.workspace, view_revision: v.state!.workspace.view_revision + 1 } } };
  ui.rerender(<LabStudentInput view={changed} submitInput={submitInput} retryRequirements={() => {}} />);
  const form = screen.getByRole('form', { name: 'Current step confirmation' });
  fireEvent.click(within(form).getByRole('button', { name: 'Use current step for confirmation' }));
  expect((screen.getByLabelText('What evidence did you review?') as HTMLTextAreaElement).value).toBe('');
  expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every(c => !c.checked)).toBe(true);
  expect(submitInput).not.toHaveBeenCalled();
  // Returning to the original context restores its draft rather than rebinding it.
  ui.rerender(<LabStudentInput view={v} submitInput={submitInput} retryRequirements={() => {}} />);
  fireEvent.click(within(form).getByRole('button', { name: 'Use current step for confirmation' }));
  expect((screen.getByLabelText('What evidence did you review?') as HTMLTextAreaElement).value).toBe('Earlier student evidence note.');
  expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true);
});
it.each([409, 422, 503])('keeps selected criteria and review note after rejection %s and suppresses duplicate review', async status => {
  let reject!: (error: unknown) => void;
  const submitInput = vi.fn(() => new Promise<void>((_, r) => reject = r));
  render(<LabStudentInput view={view()} submitInput={submitInput} retryRequirements={() => {}} />);
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  fireEvent.change(screen.getByLabelText('What evidence did you review?'), { target: { value: 'My reviewed evidence from MATLAB.' } });
  const button = screen.getByRole('button', { name: 'Confirm selected criteria' });
  fireEvent.click(button); fireEvent.click(button);
  expect(submitInput).toHaveBeenCalledTimes(1);
  reject(new ServiceError('Review rejected; your draft is kept.', status));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Review rejected'));
  expect((screen.getByLabelText('What evidence did you review?') as HTMLTextAreaElement).value).toBe('My reviewed evidence from MATLAB.');
  expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true);
});
it('requires deliberate criterion selection and records only the chosen criteria with the student note', async () => {
  const v = view(), submitInput = vi.fn(async () => {});
  render(<LabStudentInput view={v} submitInput={submitInput} retryRequirements={() => {}} />);
  const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
  expect(checkboxes.every(c => !c.checked)).toBe(true);
  fireEvent.click(checkboxes[0]);
  fireEvent.change(screen.getByLabelText('What evidence did you review?'), { target: { value: 'I checked my saved model workspace.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm selected criteria' }));
  await waitFor(() => expect(submitInput).toHaveBeenCalledTimes(1));
  expect(submitInput).toHaveBeenCalledWith(JSON.stringify(currentScope(v.state!)), { criterion_ids: ['CP-DSB-01:workspace'], review_note: 'I checked my saved model workspace.' });
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('not an assessed'));
});
it.each([409, 422, 503])('keeps the response draft after HTTP %s and does not duplicate an in-flight submission', async status => {
  const v = view(); let reject!: (error: unknown) => void;
  const submitInput = vi.fn(() => new Promise<void>((_, r) => reject = r));
  render(<LabStudentInput view={v} submitInput={submitInput} retryRequirements={() => {}} />);
  const text = screen.getByLabelText('Your own words') as HTMLTextAreaElement;
  fireEvent.change(text, { target: { value: 'My observation from this run.' } });
  fireEvent.change(screen.getByLabelText('Confidence (optional)'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record response' }));
  fireEvent.click(screen.getByRole('button', { name: 'Record response' })); expect(submitInput).toHaveBeenCalledTimes(1);
  reject(new ServiceError('The server rejected this input. Your draft is kept.', status));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('draft is kept'));
  expect(text.value).toBe('My observation from this run.');
});
it('retains a draft when context changes and requires explicit current-step selection before new input', () => {
  const v = view(), submitInput = vi.fn(async () => {});
  const ui = render(<LabStudentInput view={v} submitInput={submitInput} retryRequirements={() => {}} />);
  fireEvent.change(screen.getByLabelText('Your own words'), { target: { value: 'Draft for the old visit' } });
  const changed = { ...v, state: { ...v.state!, workspace: { ...v.state!.workspace, view_revision: v.state!.workspace.view_revision + 1 } } };
  ui.rerender(<LabStudentInput view={changed} submitInput={submitInput} retryRequirements={() => {}} />);
  expect((screen.getByLabelText('Your own words') as HTMLTextAreaElement).value).toBe('Draft for the old visit');
  expect(screen.getByRole('button', { name: 'Record response' }).matches(':disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Use current step' }));
  expect((screen.getByLabelText('Your own words') as HTMLTextAreaElement).value).toBe(''); expect(submitInput).not.toHaveBeenCalled();
});
it.each(['CP-DSB-10', 'CP-DSB-11', 'CP-DSB-12'])('shows server-authored required input and gates review on a response for the current visit (%s)', checkpoint => {
  const v = view(checkpoint);
  render(<LabStudentInput view={v} submitInput={vi.fn()} retryRequirements={() => {}} />);
  const cp = requirements.checkpoints.find(c => c.id === checkpoint)!;
  expect(screen.getByText(cp.responsePrompt!)).toBeTruthy();
  const required = cp.criteria.find(c => c.responseKinds.length)!;
  const label = screen.getByText(required.description).closest('label')!;
  fireEvent.click(label.querySelector('input')!);
  fireEvent.change(screen.getByLabelText('What evidence did you review?'), { target: { value: 'I checked the current evidence.' } });
  expect((screen.getByRole('button', { name: 'Confirm selected criteria' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Record the required response/)).toBeTruthy();
});
it('requires an explicit declaration when the tracker condition differs from the server-authored checkpoint', async () => {
  const v = view('CP-DSB-11'); v.state!.workspace.condition = 'baseline';
  const declareCondition = vi.fn(async () => {});
  render(<LabStudentInput view={v} submitInput={vi.fn()} retryRequirements={() => {}} declareCondition={declareCondition} />);
  expect(declareCondition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Declare intended phase fault' }));
  await waitFor(() => expect(declareCondition).toHaveBeenCalledWith(JSON.stringify(currentScope(v.state!))));
  expect(screen.getByRole('note').textContent).toContain('does not change or verify your model');
});
