// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useSession } from '../../app/Session';
import type { Profile } from '../../contracts/profile';
import { Onboarding } from './Onboarding';

vi.mock('../../app/Session', () => ({ useSession: vi.fn() }));
afterEach(() => { cleanup(); sessionStorage.clear(); });
it('completes in one step without confidence ratings, and keeps the form after a failed save', async () => {
  const update = vi.fn().mockRejectedValueOnce(new Error('Save failed')).mockResolvedValue(undefined);
  const profile: Profile = { schema: 'profile/v1', id: 'setup-student', displayName: 'Student', supportLanguage: 'or', studyField: 'ECE', dialLevel: 2, courseIds: [], onboarding: { step: 0, completedAt: null, fluencySelfRatings: null, easyLanguageAnswer: null } };
  vi.mocked(useSession).mockReturnValue({ profile, update, logout: vi.fn(), services: { mode: 'fixture' } } as unknown as ReturnType<typeof useSession>);
  render(<MemoryRouter initialEntries={['/onboarding']}><Routes><Route path="/onboarding" element={<Onboarding />} /><Route path="/chapters/LP-ANALOG-MODULATION" element={<h1>Chapter map</h1>} /></Routes></MemoryRouter>);
  expect(screen.queryByRole('slider', { name: /confidence/ })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: /A mix of Odia and English/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Start learning' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'What language feels comfortable?' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Start learning' }));
  await screen.findByRole('heading', { name: 'Chapter map' });
  expect(update).toHaveBeenCalledTimes(2);
  const body = update.mock.calls[1][0];
  expect(body.dialLevel).toBe(3);
  expect(body.onboarding).toMatchObject({ step: 3, fluencySelfRatings: null, easyLanguageAnswer: 'mixed' });
  expect(body.onboarding.completedAt).toEqual(expect.any(String));
}, 15000);
