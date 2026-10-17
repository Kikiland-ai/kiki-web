// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useSession } from '../../app/Session';
import { createFixtureAssessments } from '../../fixtures/assessments';
import { createFixtureLearning } from '../../fixtures/learning';
import { LearningContinuation } from './LearningContinuation';

vi.mock('../../app/Session', () => ({ useSession: vi.fn() }));
beforeEach(() => localStorage.clear());
afterEach(cleanup);
const uid = () => 'home-unit-student';
function harness() {
  const learning = createFixtureLearning(uid, createFixtureAssessments(uid));
  // This view consumes only profile.id and the learning service; no auth is performed.
  vi.mocked(useSession).mockReturnValue({ services: { learning }, profile: { id: uid() } } as ReturnType<typeof useSession>);
  return { learning, open: () => render(<MemoryRouter><LearningContinuation /></MemoryRouter>) };
}
describe('Home continuation uses existing learner progress', () => {
  it('returns to a started concept without inventing passed checks', async () => {
    const h = harness();
    await h.learning.savePosition('C-AM-09', 'CARD-AM-09-concept');
    h.open();
    const heading = await screen.findByRole('heading', { name: 'Frequency modulation and deviation' });
    expect(heading).toBeDefined();
    expect(screen.getByRole('link', { name: 'Continue learning' }).getAttribute('href')).toBe('/concepts/C-AM-09');
    expect(screen.getByText('0 / 10 checks passed')).toBeDefined();
  });
  it('rejects another learner’s progress and offers retry', async () => {
    const h = harness();
    const progress = await h.learning.getProgress('LP-ANALOG-MODULATION');
    vi.spyOn(h.learning, 'getProgress').mockResolvedValue({ ...progress, ownerLearnerId: 'other-student' });
    h.open();
    expect((await screen.findByRole('alert')).textContent).toContain('does not match your account');
    expect(screen.getByRole('button', { name: 'Retry learning continuation' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Amplitude, frequency and phase' })).toBeNull();
  });
});
