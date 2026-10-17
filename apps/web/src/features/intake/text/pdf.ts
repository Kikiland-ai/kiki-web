import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
export async function extractPdf(data: Uint8Array, signal?: AbortSignal) {
  if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') throw new Error('This file does not contain a readable PDF.');
  const task = getDocument({ data, useSystemFonts: false, disableFontFace: true, stopAtErrors: true });
  const cancel = () => { void task.destroy(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > 500) throw new Error('Choose a PDF with 1–500 pages.');
    const units: { number: number; text: string }[] = [];
    let length = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      signal?.throwIfAborted();
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
      length += new TextEncoder().encode(text).length;
      page.cleanup();
      if (length > 1024 * 1024) throw new Error('Keep extracted text below 1 MiB per document. Split this PDF into smaller documents.');
      units.push({ number: n, text });
    }
    return { method: 'pdf-text' as const, unitLabel: 'page' as const, unitCount: pdf.numPages, units };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('Use an unlocked PDF, or paste text you can read from it.', { cause: error });
    throw error;
  } finally { signal?.removeEventListener('abort', cancel); await task.destroy(); }
}
