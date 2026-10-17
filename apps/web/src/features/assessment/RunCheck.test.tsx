// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { useSession } from '../../app/Session';
import { createFixtureAssessments } from '../../fixtures/assessments';
import { useAssessmentState } from './AssessmentState';
import { RunCheck } from './RunCheck';

vi.mock('../../app/Session', () => ({ useSession: vi.fn() }));
vi.mock('./AssessmentState', () => ({ useAssessmentState: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.mocked(useAssessmentState).mockReturnValue({ refresh: vi.fn() } as unknown as ReturnType<typeof useAssessmentState>);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); });
async function open() {
  const assessments = createFixtureAssessments(() => 'focus-student');
  const run = await assessments.start('AS-AM-01');
  vi.mocked(useSession).mockReturnValue({ profile: { id: 'focus-student', supportLanguage: 'or' }, services: { mode: 'fixture', assessments, auth: { registerSignOutCleanup: () => () => {} } } } as unknown as ReturnType<typeof useSession>);
  render(<RouterProvider router={createMemoryRouter([{ path: '/assessments/:assessmentId/:runId', element: <RunCheck /> }], { initialEntries: [`/assessments/AS-AM-01/${run.runId}`] })}/>);
  await screen.findByRole('radio', { name: /Amplitude/ });
  return { assessments, run };
}
it('restores the chosen answer after a save, then focuses the new question after navigation', async () => {
  const { assessments } = await open();
  const save = assessments.saveDraft.bind(assessments);
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(assessments, 'saveDraft').mockImplementation(async (...args) => { await waiting; return save(...args); });
  const choice = screen.getAllByRole('radio')[2];
  choice.focus(); fireEvent.click(choice);
  // jsdom does not reproduce native blur when a fieldset becomes disabled.
  expect((choice as HTMLInputElement).disabled || choice.closest('fieldset')?.disabled).toBe(true);
  choice.blur();
  await act(async () => { release(); });
  await screen.findByText('Draft saved · 1/5 answered');
  await waitFor(() => expect(document.activeElement).toBe(choice));
  fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
  const next = await screen.findByRole('heading', { name: 'What is the period of a 100 Hz signal?' });
  await waitFor(() => expect(document.activeElement).toBe(next));
  expect(screen.getByRole('button', { name: 'Question 2, unanswered' }).getAttribute('aria-current')).toBe('step');
});
it('does not steal focus from another control when an answer save finishes', async () => {
  const { assessments } = await open();
  const save = assessments.saveDraft.bind(assessments);
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(assessments, 'saveDraft').mockImplementation(async (...args) => { await waiting; return save(...args); });
  const choice = screen.getAllByRole('radio')[0];
  choice.focus(); fireEvent.click(choice);
  const language = screen.getByRole('button', { name: 'English' });
  language.focus(); fireEvent.click(language);
  await act(async () => { release(); });
  await screen.findByText('Draft saved · 1/5 answered');
  expect(document.activeElement).toBe(language);
});
