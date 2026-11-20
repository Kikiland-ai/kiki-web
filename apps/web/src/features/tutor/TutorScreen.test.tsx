// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { useSession } from '../../app/Session';
import { createFixtureTutor } from '../../fixtures/tutor';
import { TutorScreen } from './TutorScreen';

vi.mock('../../app/Session', () => ({ useSession: vi.fn() }));

beforeEach(() => {
  sessionStorage.clear();
  // reduced motion: board items appear without the stagger, so the test reads the final board
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); });

function open(tutor = createFixtureTutor(() => 'u1'), questionId = 'ece-phase-error') {
  vi.mocked(useSession).mockReturnValue({ profile: { id: 'u1', supportLanguage: 'en', dialLevel: 5 }, services: { mode: 'fixture', tutor } } as unknown as ReturnType<typeof useSession>);
  render(<RouterProvider router={createMemoryRouter([{ path: '/concepts/:conceptId/talk/:questionId', element: <TutorScreen /> }],
    { initialEntries: [`/concepts/C-AM-08/talk/${questionId}`] })} />);
  return tutor;
}

const board = () => screen.getByRole('region', { name: 'Whiteboard' });
const items = () => [...board().querySelectorAll('[data-item]')].map(e => e.getAttribute('data-item'));
const chip = (name: RegExp) => fireEvent.click(within(screen.getByRole('group', { name: 'Quick replies' })).getByRole('button', { name }));

it('runs a whole session by chips, uncovering the board only as it is earned, to the scorecard', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Start talking it through' }));
  await screen.findByText(/do you get all of the message back/);
  expect(items()).toEqual(['q']);
  expect(screen.getByRole('list', { name: 'Stages' }).querySelector('[aria-current="step"]')?.textContent).toMatch(/Predict/);

  chip(/Part of it/);
  await waitFor(() => expect(items()).toContain('traces-60'));
  expect(items()).toContain('mix');                     // next stage's first step, on enter
  expect(items()).not.toContain('gain-out');            // why-cos answer not yet earned
  await screen.findByText(/How does the phase error φ change m\(t\)/);

  chip(/Scales it by cos/);
  await waitFor(() => expect(items()).toEqual(expect.arrayContaining(['identity', 'lpf-out', 'gain-out'])));
  expect(items()).not.toContain('cos60');
  chip(/0\.5, half/);
  await waitFor(() => expect(items()).toContain('cos60'));
  expect(items()).not.toContain('cos90');
  chip(/Nothing: cos 90/);
  await waitFor(() => expect(items()).toEqual(expect.arrayContaining(['cos90', 'traces-90'])));
  chip(/Use a model sentence/);

  await screen.findByRole('heading', { name: 'Your scorecard' });
  expect(screen.queryByRole('region', { name: 'Whiteboard' })).toBeNull();      // the sheet replaces the live board
  const sheet = screen.getByRole('region', { name: 'Revision sheet' });
  expect(sheet.querySelectorAll('[data-item]').length).toBeGreaterThan(8);
  expect(sheet.querySelector('[data-item="result"]')).not.toBeNull();
  expect([...sheet.querySelectorAll('[data-stage]')].every(s => s.getAttribute('data-open') === 'true')).toBe(true);
  const metrics = screen.getByRole('list', { name: 'How you did' });
  expect(within(metrics).getAllByText('Got it').length).toBeGreaterThanOrEqual(2);
  expect(screen.queryByRole('group', { name: 'Quick replies' })).toBeNull();
});

it('folds finished stages to their results and keeps the current stage open', async () => {
  open(undefined, 'ece-am-envelope-design');
  fireEvent.click(await screen.findByRole('button', { name: 'Start talking it through' }));
  await waitFor(() => expect(items()).toContain('q'));
  expect(screen.getByRole('button', { name: 'Show only the given values' })).toBeTruthy();   // full question before any work
  const click = (route: string) => fireEvent.click(document.querySelector(`[data-route="${route}"]`)!);
  click('pt-59');
  await waitFor(() => expect(board().querySelector('[data-stage="power"]')).not.toBeNull());
  expect(screen.getByRole('button', { name: 'Show the full question' })).toBeTruthy();       // compact once work starts
  click('eta-15');                                       // finishes "power"; its fresh result keeps it open
  await waitFor(() => expect(board().querySelector('[data-stage="window"]')).not.toBeNull());
  expect(board().querySelector('[data-stage="power"]')!.getAttribute('data-open')).toBe('true');
  click('window-both');                                  // next reveal: "power" folds to its results
  await waitFor(() => expect(board().querySelector('[data-stage="power"]')!.getAttribute('data-open')).toBe('false'));
  const power = board().querySelector('[data-stage="power"]')!;
  expect(power.querySelectorAll('.katex').length).toBeGreaterThan(0);                     // results still readable
  fireEvent.click(within(power as HTMLElement).getByRole('button'));                      // the student can reopen it
  expect(power.getAttribute('data-open')).toBe('true');
});

it('routes a misconception through its explanation and shows hints for an unclear reply', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Start talking it through' }));
  await screen.findByText(/do you get all of the message back/);
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'no idea really' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText(/With the carriers lined up, you get the whole message/);    // hint rung 1
  expect(items()).toEqual(['q']);
  chip(/All of it/);
  await screen.findByText(/only the phase moved to 60°/);                               // show node
  await waitFor(() => expect(items()).toContain('traces-60'));
});

it('restates the question for an off-topic reply without moving on', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Start talking it through' }));
  await screen.findByText(/do you get all of the message back/);
  const off = 'ଆଜି Canteen ରେ କଣ ମିଳୁଛି?';                                               // routing-set off_topic reply
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: off } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getAllByText(/do you get all of the message back/).length).toBe(2));
  expect(items()).toEqual(['q']);
});

it('resumes the same session after a reload with the board as it was', async () => {
  const tutor = open();
  fireEvent.click(await screen.findByRole('button', { name: 'Start talking it through' }));
  await screen.findByText(/do you get all of the message back/);
  chip(/Part of it/);
  await waitFor(() => expect(items()).toContain('traces-60'));
  cleanup();
  open(tutor);
  fireEvent.click(await screen.findByRole('button', { name: 'Start talking it through' }));
  await screen.findByText('Welcome back. Here is where we were:');
  expect(items()).toEqual(expect.arrayContaining(['q', 'traces-60', 'rx', 'mix']));
});

it('explains when voice is unavailable and keeps text working', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Start talking it through' }));
  await screen.findByText(/do you get all of the message back/);
  fireEvent.click(screen.getByRole('button', { name: 'Talk by voice' }));
  await screen.findByText(/Voice is not available in the sample preview/);
  chip(/Part of it/);
  await waitFor(() => expect(items()).toContain('traces-60'));
});

it('renders the hard question with its figures', async () => {
  open(undefined, 'ece-am-envelope-design');
  fireEvent.click(await screen.findByRole('button', { name: 'Start talking it through' }));
  await waitFor(() => expect(items().length).toBeGreaterThan(0));
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/envelope detector/i);
});
