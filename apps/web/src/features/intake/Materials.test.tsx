// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { MaterialsProvider, useMaterials } from './Materials';
import { MaterialRequest } from './Request';
import { IntakeRequestSchema, type IntakeRequest } from '../../contracts/intake';
import { Library, SourceViewer } from '../library/Library';
import { ServiceError } from '../../services/types';

const mocks = vi.hoisted(() => ({
  list: vi.fn(), listPage: vi.fn(), get: vi.fn(), subscribe: vi.fn(), cleanup: vi.fn(),
}));
// Stable service identity avoids effect reinitialization; this matches the real Session provider.
vi.mock('../../app/Session', () => {
  const services = { mode: 'connected', intake: { list: mocks.list, listPage: mocks.listPage, get: mocks.get },
    auth: { registerSignOutCleanup: mocks.cleanup } };
  const profile = { id: 'unit-student', courseIds: ['CRS-AC-ECE'] };
  return { useSession: () => ({ profile, services }) };
});
function receipt(id: string, owner = 'unit-student'): IntakeRequest {
  return IntakeRequestSchema.parse({
    schema: 'intake-view/v1', id, ownerLearnerId: owner, courseId: 'CRS-AC-ECE',
    kind: 'notes', topic: id, note: '', classDate: '', status: 'stored',
    sources: [{ id: id + '-0', requestId: id, ownerLearnerId: owner, title: 'notes.pdf',
      mime: 'application/pdf', size: 500, createdAt: '2026-10-15T00:00:00Z' }],
    outline: null, jobId: id, lessonPlanId: null, failure: null,
    createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z',
  });
}
function Probe() {
  const materials = useMaterials();
  return <><span>{materials.requests.map(r => r.id).join(',')}</span><span role="alert">{materials.error}</span><button onClick={() => void materials.loadMore()} disabled={!materials.hasMore}>More</button></>;
}
beforeEach(() => { vi.resetAllMocks(); mocks.cleanup.mockReturnValue(() => undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('appends older material once, preserving owner checks and explicit pagination', async () => {
  mocks.listPage.mockResolvedValueOnce({ requests: [receipt('first')], nextCursor: 'first' })
    .mockResolvedValueOnce({ requests: [receipt('first'), receipt('older')], nextCursor: null });
  render(<MaterialsProvider><Probe /></MaterialsProvider>);
  await screen.findByText('first');
  fireEvent.click(screen.getByText('More'));
  await screen.findByText('first,older');
  expect(mocks.listPage.mock.calls[1][0]).toBe('first');
  expect((screen.getByText('More') as HTMLButtonElement).disabled).toBe(true);
});
it('rejects a foreign row in a subsequent page', async () => {
  mocks.listPage.mockResolvedValueOnce({ requests: [receipt('first')], nextCursor: 'first' })
    .mockResolvedValueOnce({ requests: [receipt('private', 'other')], nextCursor: null });
  render(<MaterialsProvider><Probe /></MaterialsProvider>);
  await screen.findByText('first'); fireEvent.click(screen.getByText('More'));
  await screen.findByText('This could not be completed. Please try again.');
  expect(screen.queryByText('first,private')).toBeNull();
});
it('shows saved originals without pretending that a processor is reading them', async () => {
  const record = receipt('saved');
  mocks.listPage.mockResolvedValue({ requests: [record], nextCursor: null });
  mocks.get.mockResolvedValue(record);
  render(<MemoryRouter initialEntries={['/intake/saved']}><MaterialsProvider><Routes><Route path="/intake/:requestId" element={<MaterialRequest />} /></Routes></MaterialsProvider></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Your files are saved.' });
  expect(screen.getByText('Saved in Library')).toBeDefined();
  expect(screen.getByText(/Reading the material and preparing lessons are not available yet/)).toBeDefined();
  expect(screen.queryByText('Kiki is reading the uploaded material.')).toBeNull();
  expect(screen.queryByRole('button', { name: /Preview/ })).toBeNull();
});
it('does not describe a failed Library fetch as an empty library', async () => {
  mocks.listPage.mockRejectedValue(new ServiceError('Library is temporarily unavailable.'));
  render(<MemoryRouter><MaterialsProvider><Library /></MaterialsProvider></MemoryRouter>);
  await screen.findByText('Library is temporarily unavailable.');
  expect(screen.queryByText('A home for your first notes.')).toBeNull();
});
it('shows one static upload card per document without exposing extraction or source links', async () => {
  const record = receipt('uploaded');
  record.status = 'text_saved'; record.jobId = null;
  record.sources = ['Lecture 5.pdf', 'Lecture 6.pptx'].map((title, i) => ({
    ...record.sources[0], id: `uploaded-${i}`, title, originalAvailable: false,
    textSummary: { method: 'pdf-text', unitLabel: 'page', unitCount: 1, byteCount: 100, chunkCount: 1, warnings: ['Internal extraction warning'] },
  }));
  mocks.listPage.mockResolvedValue({ requests: [record], nextCursor: null });
  render(<MemoryRouter><MaterialsProvider><Library /></MaterialsProvider></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Lecture 5.pdf' });
  expect(screen.getAllByRole('article')).toHaveLength(2);
  for (const card of screen.getAllByRole('article')) expect(card.querySelector('a,button,[tabindex]')).toBeNull();
  for (const card of screen.getAllByRole('article')) expect(card.textContent).toContain('Uploaded');
  expect(screen.queryByText(/Internal extraction warning|Text saved|original not stored|Read saved text/)).toBeNull();
  expect(screen.queryByRole('link', { name: 'Open request' })).toBeNull();
});
it('redirects old text-reader URLs to the static Library without retrieving document content', async () => {
  mocks.listPage.mockResolvedValue({ requests: [receipt('saved')], nextCursor: null });
  render(<MemoryRouter initialEntries={['/library/saved-0?view=text']}><MaterialsProvider><Routes>
    <Route path="/library/:sourceId" element={<SourceViewer />} />
    <Route path="/library" element={<Library />} />
  </Routes></MaterialsProvider></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Your Library' });
  expect(mocks.get).not.toHaveBeenCalled();
});
it('does not poll stored originals when no processing worker is active', async () => {
  mocks.listPage.mockResolvedValue({ requests: [receipt('first')], nextCursor: null });
  render(<MaterialsProvider><Probe /></MaterialsProvider>);
  await screen.findByText('first');
  vi.useFakeTimers(); await act(async () => vi.advanceTimersByTime(15000));
  expect(mocks.listPage).toHaveBeenCalledTimes(1);
});
it('ignores a late page after sign-out cleanup aborts the private read', async () => {
  let finish: (value: { requests: IntakeRequest[]; nextCursor: null }) => void = () => undefined;
  mocks.listPage.mockResolvedValueOnce({ requests: [receipt('first')], nextCursor: 'first' })
    .mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  render(<MaterialsProvider><Probe /></MaterialsProvider>);
  await screen.findByText('first'); fireEvent.click(screen.getByText('More'));
  act(() => mocks.cleanup.mock.calls[0][0]());
  await act(async () => finish({ requests: [receipt('older')], nextCursor: null }));
  await waitFor(() => expect(screen.queryByText('first,older')).toBeNull());
  expect(mocks.listPage.mock.calls[1][1].aborted).toBe(true);
});
