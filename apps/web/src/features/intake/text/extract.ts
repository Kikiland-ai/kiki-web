import { PPTX_MIME, TextDocumentSchema, type TextDocument } from '../../../contracts/document-text';
import { MAX_FILE_BYTES } from '../../../contracts/intake';
// eslint-disable-next-line no-control-regex -- Intentionally remove non-text control characters from extracted documents.
function clean(text: string) { return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim(); }
export async function extractDocument(file: File, signal?: AbortSignal): Promise<TextDocument> {
  signal?.throwIfAborted();
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: choose a non-empty file up to 10 MB.`);
  const name = file.name.toLowerCase();
  let result: Pick<TextDocument, 'method' | 'unitLabel' | 'unitCount' | 'units'>;
  let mime: TextDocument['mime'];
  if (name.endsWith('.pdf')) {
    mime = 'application/pdf';
    const { extractPdf } = await import('./pdf');
    result = await extractPdf(new Uint8Array(await file.arrayBuffer()), signal);
  } else if (name.endsWith('.pptx')) {
    mime = PPTX_MIME;
    const { extractPptx } = await import('./pptx');
    result = extractPptx(new Uint8Array(await file.arrayBuffer()));
  } else throw new Error('Choose a PDF or PPTX. Convert older .ppt files to .pptx or PDF first.');
  signal?.throwIfAborted();
  const units = result.units.map(u => ({ ...u, text: clean(u.text) })).filter(u => u.text);
  if (!units.length) throw new Error(`${file.name}: no selectable text was found. Scanned pages/images need OCR; you can paste text you have already extracted.`);
  return TextDocumentSchema.parse({ ...result, units, title: file.name, mime, size: file.size, warnings: [
    'Plain text only. Images, diagrams, slide layout and equation formatting are not retained.',
    ...(units.length < result.unitCount ? [`${result.unitCount - units.length} ${result.unitLabel}(s) had no extractable text. Review the saved text for missing content.`] : []),
  ] });
}
export function pastedDocument(title: string, text: string): TextDocument {
  text = clean(text);
  return TextDocumentSchema.parse({ title, mime: 'text/plain', size: new TextEncoder().encode(text).length, method: 'pasted', unitLabel: 'section', unitCount: 1, units: [{ number: 1, text }], warnings: ['Pasted by the student; not verified against an original document.'] });
}
