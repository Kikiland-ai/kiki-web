// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AddMaterial } from './AddMaterial';
const mocks = vi.hoisted(() => ({ extract: vi.fn(), upload: vi.fn() }));
vi.mock('./text/extract', () => ({ extractDocument: mocks.extract }));
vi.mock('./Materials', () => ({ useMaterials: () => ({ upload: mocks.upload, uploading: false, cancelUpload: vi.fn() }) }));
vi.mock('../../app/Session', () => {
  const services = { mode: 'connected', auth: { registerSignOutCleanup: () => () => undefined } };
  return { useSession: () => ({ profile: { courseIds: ['CRS-AC-ECE'] }, services }) };
});
const document = { title: 'Lecture.pdf', mime: 'application/pdf', size: 1000, method: 'pdf-text', unitLabel: 'page', unitCount: 1, units: [{ number: 1, text: 'INTERNAL DOCUMENT CONTENT' }], warnings: ['INTERNAL EXTRACTION DETAILS'] };
function open() {
  return render(<MemoryRouter initialEntries={['/subjects/CRS-AC-ECE/material']}><Routes>
    <Route path="/subjects/:courseId/material" element={<AddMaterial />} />
    <Route path="/library" element={<h1>Upload history</h1>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => { vi.resetAllMocks(); mocks.extract.mockResolvedValue(document); mocks.upload.mockResolvedValue({}); });
afterEach(cleanup);
it('keeps document content internal, uploads it unchanged and returns directly to Library', async () => {
  const view = open();
  fireEvent.change(view.container.querySelector('#material-files')!, { target: { files: [new File(['pdf'], 'Lecture.pdf')] } });
  await screen.findByText('Lecture.pdf');
  expect(screen.queryByText(/INTERNAL DOCUMENT CONTENT|INTERNAL EXTRACTION DETAILS|Review extracted text|Firestore/)).toBeNull();
  expect(screen.queryByLabelText('Document text')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Upload material' }));
  await screen.findByRole('heading', { name: 'Upload history' });
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  expect(mocks.upload.mock.calls[0][0].documents).toEqual([document]);
});
it('does not add failed documents or discard valid documents in a mixed selection', async () => {
  mocks.extract.mockResolvedValueOnce(document).mockRejectedValueOnce(new Error('Internal parser failure'));
  const view = open();
  fireEvent.change(view.container.querySelector('#material-files')!, { target: { files: [new File(['pdf'], 'Lecture.pdf'), new File(['bad'], 'bad.pdf')] } });
  await screen.findByText('Lecture.pdf');
  expect(screen.getByRole('alert').textContent).toContain('bad.pdf: We couldn’t prepare this document');
  expect(screen.queryByText(/Internal parser failure/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Lecture.pdf' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Upload material' }) as HTMLButtonElement).disabled).toBe(true));
});
