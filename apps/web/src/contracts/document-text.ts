import { z } from 'zod';
import { SourceSchema, type CreateIntake } from './intake';
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const MAX_TEXT_BYTES = 1024 * 1024;
export const TextDocumentSchema = z.object({
  title: z.string().trim().min(1).max(240), mime: z.enum(['application/pdf', PPTX_MIME, 'text/plain']),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  method: z.enum(['pdf-text', 'pptx-text', 'pasted']), unitLabel: z.enum(['page', 'slide', 'section']),
  unitCount: z.number().int().min(1).max(500),
  units: z.array(z.object({ number: z.number().int().min(1).max(500), text: z.string().min(1) })).min(1).max(500),
  warnings: z.array(z.string().max(240)).max(5),
}).superRefine((d, ctx) => {
  if (d.units.reduce((sum, unit) => sum + new TextEncoder().encode(unit.text).length, 0) > MAX_TEXT_BYTES) ctx.addIssue({ code: 'custom', message: 'Keep extracted text below 1 MiB per document.' });
  if (d.units.some((u, i) => !u.text.trim() || u.number > d.unitCount || i > 0 && u.number <= d.units[i - 1].number)) ctx.addIssue({ code: 'custom', message: 'Text units must be non-empty and in document order.' });
  const expected = d.mime === 'application/pdf' ? ['pdf-text','page'] : d.mime === PPTX_MIME ? ['pptx-text','slide'] : ['pasted','section'];
  if (d.method !== expected[0] || d.unitLabel !== expected[1]) ctx.addIssue({ code: 'custom', message: 'Text extraction method does not match the source type.' });
});
export type TextDocument = z.infer<typeof TextDocumentSchema>;
export type CreateTextIntake = Omit<CreateIntake, 'files'> & { documents: TextDocument[] };
export const SourceTextSchema = z.object({
  source: SourceSchema,
  chunks: z.array(z.object({ index: z.number().int().min(0), text: z.string().min(1) })).max(5),
  nextCursor: z.number().int().min(1).nullable(),
});
export type SourceText = z.infer<typeof SourceTextSchema>;
/** Stable, readable text with page/slide provenance. UTF-8 boundaries are preserved by the server. */
export function documentText(document: TextDocument) {
  return document.units.map(u => `${document.unitLabel[0].toUpperCase() + document.unitLabel.slice(1)} ${u.number}\n${u.text}`).join('\n\n');
}
export function splitDocumentText(text: string): string[] {
  const chunks: string[] = []; let current = '', bytes = 0;
  for (const char of text) {
    const point = char.codePointAt(0)!;
    const width = point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (bytes + width > 32768) { chunks.push(current); current = ''; bytes = 0; }
    current += char; bytes += width;
  }
  if (current) chunks.push(current);
  return chunks;
}
