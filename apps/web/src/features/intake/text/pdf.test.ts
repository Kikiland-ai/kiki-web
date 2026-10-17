import { beforeAll, describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { extractPdf } from './pdf';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
function pdf(text: string) {
  const stream = `BT /F1 12 Tf 40 100 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count 1 /Kids [3 0 R] >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let source = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(source.length); source += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = source.length;
  source += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new TextEncoder().encode(source);
}
beforeAll(() => { GlobalWorkerOptions.workerSrc = pathToFileURL(resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href; });
describe('actual PDF text engine', () => {
  it('extracts selectable text with page provenance', async () => {
    const result = await extractPdf(pdf('The carrier stays at 2000 Hz.'));
    expect(result.unitCount).toBe(1);
    expect(result.units[0].text).toContain('The carrier stays at 2000 Hz.');
  });
  it('returns no invented content for an empty page and rejects invalid input', async () => {
    const result = await extractPdf(pdf(''));
    expect(result.units[0].text.trim()).toBe('');
    await expect(extractPdf(new TextEncoder().encode('not a PDF'))).rejects.toThrow('readable PDF');
  });
});
