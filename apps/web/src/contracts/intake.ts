import { z } from 'zod';

export const MATERIAL_KINDS = ['syllabus', 'notes', 'experiment_sheet'] as const;
export const MATERIAL_LABELS = { syllabus: 'Syllabus', notes: 'Class notes', experiment_sheet: 'Lab manual' } as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;
export const MimeSchema = z.enum(['application/pdf', 'image/jpeg', 'image/png']);
export const SourceSchema = z.object({
  id: z.string().min(1), requestId: z.string().min(1), ownerLearnerId: z.string().min(1),
  title: z.string().min(1), mime: MimeSchema, size: z.number().int().positive().max(MAX_FILE_BYTES),
  sha256: z.string().optional(),
  createdAt: z.string().datetime(),
});
export const OutlineSchema = z.object({
  title: z.string().trim().min(1).max(180), provisional: z.boolean(),
  concepts: z.array(z.object({ id: z.string().min(1), title: z.string().trim().min(1).max(180), included: z.boolean() })).min(1).max(30),
  sourceIds: z.array(z.string()), exclusions: z.array(z.string()),
});
export const IntakeRequestSchema = z.object({
  schema: z.literal('intake-view/v1'), id: z.string().min(1), ownerLearnerId: z.string().min(1),
  courseId: z.string().min(1), kind: z.enum(MATERIAL_KINDS), topic: z.string().trim().min(1).max(180),
  note: z.string().max(1000), classDate: z.string(),
  status: z.enum(['stored', 'reading', 'needs_review', 'generating', 'ready', 'failed']),
  sources: z.array(SourceSchema).min(1).max(MAX_FILES), outline: OutlineSchema.nullable(),
  jobId: z.string().min(1), lessonPlanId: z.string().nullable(),
  failure: z.object({ message: z.string(), canRetry: z.boolean() }).nullable(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).superRefine((r, ctx) => {
  if (r.sources.some(s => s.ownerLearnerId !== r.ownerLearnerId || s.requestId !== r.id)) ctx.addIssue({ code: 'custom', message: 'Source ownership or request mismatch.' });
  if (r.outline?.sourceIds.some(id => !r.sources.some(s => s.id === id))) ctx.addIssue({ code: 'custom', message: 'Outline references an unknown source.' });
  if (['needs_review', 'generating', 'ready'].includes(r.status) && !r.outline) ctx.addIssue({ code: 'custom', message: 'This stage requires an outline.' });
  if (r.status === 'failed' && !r.failure) ctx.addIssue({ code: 'custom', message: 'Failed jobs require a recovery message.' });
  if (r.status === 'ready' && !r.lessonPlanId) ctx.addIssue({ code: 'custom', message: 'Ready requests require a source-linked lesson plan.' });
  if (new Set(r.sources.map(s => s.id)).size !== r.sources.length) ctx.addIssue({ code: 'custom', message: 'Duplicate original source.' });
  if (r.outline && new Set(r.outline.concepts.map(c => c.id)).size !== r.outline.concepts.length) ctx.addIssue({ code: 'custom', message: 'Duplicate outline concept.' });
});
export type SourceAsset = z.infer<typeof SourceSchema>;
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;
export type Outline = z.infer<typeof OutlineSchema>;
export interface CreateIntake {
  courseId: string; kind: typeof MATERIAL_KINDS[number]; topic: string; note: string; classDate: string; files: File[];
}
export interface IntakeApi {
  list(signal?: AbortSignal): Promise<IntakeRequest[]>;
  listPage?(cursor?: string, signal?: AbortSignal): Promise<{ requests: IntakeRequest[]; nextCursor: string | null }>;
  get(id: string, signal?: AbortSignal): Promise<IntakeRequest>;
  create(input: CreateIntake, operationKey: string, signal?: AbortSignal): Promise<IntakeRequest>;
  confirm(id: string, outline: Outline, operationKey: string, signal?: AbortSignal): Promise<IntakeRequest>;
  retry(id: string, operationKey: string, signal?: AbortSignal): Promise<IntakeRequest>;
  source(id: string, signal?: AbortSignal): Promise<{ source: SourceAsset; blob: Blob }>;
  /** Development-only controls; no automatic pretend processing. */
  preview?(id: string, stage: 'needs_review' | 'ready' | 'failed'): Promise<IntakeRequest>;
}
export const RequestEnvelope = z.object({ request: IntakeRequestSchema });
export const RequestsEnvelope = z.object({ requests: z.array(IntakeRequestSchema), nextCursor: z.string().min(1).nullable().optional() });
export const SourceEnvelope = z.object({ source: SourceSchema });
export function assertOwner(record: { ownerLearnerId: string }, uid: string) {
  if (record.ownerLearnerId !== uid) throw new Error('Record does not belong to the signed-in learner.');
}
export async function validateMaterial(file: File): Promise<string | null> {
  if (!MimeSchema.safeParse(file.type).success) return `${file.name}: use a PDF, JPEG or PNG.`;
  if (!file.size || file.size > MAX_FILE_BYTES) return `${file.name}: choose a non-empty file up to 10 MB.`;
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pdf = [37, 80, 68, 70, 45], png = [137, 80, 78, 71, 13, 10, 26, 10], jpg = [255, 216, 255];
  const header = file.type === 'application/pdf' ? pdf : file.type === 'image/png' ? png : jpg;
  if (!header.every((v, i) => bytes[i] === v)) return `${file.name}: this file does not match its PDF/image format. Try exporting it again.`;
  return null;
}
