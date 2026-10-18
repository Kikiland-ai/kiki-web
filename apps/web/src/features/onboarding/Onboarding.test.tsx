// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useSession } from '../../app/Session';
import type { Profile } from '../../contracts/profile';
import { Onboarding } from './Onboarding';

vi.mock('../../app/Session', () => ({ useSession: vi.fn() }));
beforeEach(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }));
afterEach(() => { cleanup(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); });
it('keeps a failed step editable, then focuses the next heading only after a confirmed save', async () => {
  const update = vi.fn().mockRejectedValueOnce(new Error('Save failed')).mockResolvedValue(undefined);
  const profile: Profile = { schema: 'profile/v1', id: 'setup-student', displayName: 'Student', supportLanguage: 'or', studyField: 'ECE', dialLevel: 2, courseIds: [], onboarding: { step: 0, completedAt: null, fluencySelfRatings: null, easyLanguageAnswer: null } };
  vi.mocked(useSession).mockReturnValue({ profile, update, logout: vi.fn(), services: { mode: 'fixture' } } as unknown as ReturnType<typeof useSession>);
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'What language feels comfortable?' })).toBeDefined();
  expect(screen.queryByRole('heading', { name: 'How comfortable do you feel?' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
  const next = await screen.findByRole('heading', { name: 'How comfortable do you feel?' });
  await waitFor(() => expect(document.activeElement).toBe(next));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'What language feels comfortable?' })));
  expect(update).toHaveBeenCalledTimes(2);
});
