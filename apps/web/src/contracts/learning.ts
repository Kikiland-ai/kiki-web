import { z } from 'zod';
import { DsbVisualSchema } from './teaching-visual';
import type { ChapterView, ChapterProgress, ConceptLesson, ConceptProgress } from './api';
import { ASSESSMENT_CONCEPTS } from './assessment-catalog';
import { COURSE } from './profile';

const Text = z.object({ en: z.string().min(1), or: z.string().min(1) });
const Position = z.object({ placardId: z.string().min(1), updatedAt: z.string().datetime() });
export const ConceptProgressSchema = z.object({
  conceptId: z.string().min(1), status: z.enum(['not_started', 'learning', 'revisit', 'passed']),
  theoryCheck: z.object({ status: z.enum(['not_attempted', 'revisit', 'passed']), latestRunId: z.string().optional(), attemptPercent: z.number().min(0).max(100).optional() }),
  position: Position.optional(),
}) satisfies z.ZodType<ConceptProgress>;
export const ChapterSchema = z.object({
  planId: z.literal(COURSE.chapterId), courseId: z.literal(COURSE.id), title: Text,
  broadConcepts: z.array(z.object({ id: z.string(), title: Text, order: z.number().int().positive() })).min(1),
  concepts: z.array(z.object({ id: z.string(), order: z.number().int().positive(), broadConceptId: z.string(), title: Text, canDo: z.string(), prerequisiteIds: z.array(z.string()), requiredForLab: z.boolean(), estMinutes: z.number().positive(), assessmentId: z.string() })).length(10),
  chapterAssessmentId: z.literal('AS-AM-CHAPTER'), practicalId: z.string().optional(),
  review: z.object({ content: z.enum(['draft', 'reviewed']), odia: z.enum(['draft', 'reviewed']) }),
}).superRefine((chapter, ctx) => {
  if (new Set(chapter.concepts.map(c => c.id)).size !== 10 || chapter.concepts.some(c => !ASSESSMENT_CONCEPTS.some(expected => expected.id === c.id && expected.assessmentId === c.assessmentId && expected.requiredForLab === c.requiredForLab) || !chapter.broadConcepts.some(b => b.id === c.broadConceptId) || c.prerequisiteIds.some(id => !chapter.concepts.some(p => p.id === id)))) ctx.addIssue({ code: 'custom', message: 'Chapter IDs or prerequisites do not match this learning case.' });
}) satisfies z.ZodType<ChapterView>;
export const LessonSchema = z.object({
  visual: DsbVisualSchema.optional(), conceptId: z.string(), planId: z.literal(COURSE.chapterId), title: Text, keyIdea: Text,
  placards: z.array(z.object({ id: z.string(), kind: z.enum(['definition', 'concept', 'application', 'recap']), title: Text, body: Text, termIds: z.array(z.string()), sources: z.array(z.object({ origin: z.string(), label: z.string(), url: z.string().url().optional() })) })).length(4),
  terms: z.array(z.object({ id: z.string(), term: z.string(), definition: z.string(), symbol: z.string().optional(), unit: z.string().optional(), pronunciationOr: z.string(), glossOr: z.string(), example: Text.optional() })),
  example: z.object({ title: Text, scenario: Text, takeaway: Text }),
  media: z.object({ status: z.enum(['none','pending','ready','failed']), posterUrl: z.string().optional(), audioUrl: z.string().optional(), narrationKind: z.enum(['generated','recorded','fixture']).optional(), timing: z.enum(['none','clip_duration_only','sentence_aligned']).optional() }), assessmentId: z.string(),
}).superRefine((lesson, ctx) => {
  if (!ASSESSMENT_CONCEPTS.some(c => c.id === lesson.conceptId && c.assessmentId === lesson.assessmentId) || new Set(lesson.placards.map(p => p.id)).size !== 4 || lesson.placards.some((p, i) => p.kind !== ['definition','concept','application','recap'][i] || p.termIds.some(id => !lesson.terms.some(t => t.id === id)))) ctx.addIssue({ code:'custom', message:'Lesson IDs, placards or terms do not match.' });
  if (lesson.visual && (lesson.conceptId !== 'C-AM-04' || [lesson.visual.sidebandTermId,lesson.visual.carrierTermId,lesson.visual.signalTermId].some(id=>!lesson.terms.some(t=>t.id===id)))) ctx.addIssue({code:'custom',message:'Visual and glossary do not match this concept.'});
}) satisfies z.ZodType<ConceptLesson>;
const Coverage = z.object({ done: z.number().nonnegative(), total: z.number().positive() }).refine(c => c.done <= c.total).nullable();
export const ProgressSchema = z.object({
  ownerLearnerId: z.string().min(1), planId: z.literal(COURSE.chapterId), concepts: z.array(ConceptProgressSchema).length(10),
  chapterTest: z.object({ status: z.enum(['not_attempted','revisit','passed']), latestRunId: z.string().optional(), attemptPercent: z.number().min(0).max(100).optional() }),
  rings: z.object({ concept: Coverage, words: Coverage, english: Coverage, lab: Coverage }),
  labReadiness: z.object({ practicalId: z.string(), ready: z.boolean(), requiredConceptIds: z.array(z.string()), missingConceptIds: z.array(z.string()), evidenceRunIds: z.array(z.string()), chapterTestRequired: z.literal(false) }),
}).superRefine((progress, ctx) => {
  const concepts = progress.concepts;
  const required: string[] = ASSESSMENT_CONCEPTS.filter(c => c.requiredForLab).map(c => c.id);
  const missing = concepts.filter(c => required.includes(c.conceptId) && c.theoryCheck.status !== 'passed').map(c => c.conceptId);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));
  const lab = progress.labReadiness;
  if (new Set(concepts.map(c => c.conceptId)).size !== 10 || concepts.some(c => !ASSESSMENT_CONCEPTS.some(expected => expected.id === c.conceptId) || (c.status === 'passed') !== (c.theoryCheck.status === 'passed') || (c.status === 'revisit') !== (c.theoryCheck.status === 'revisit') || (c.theoryCheck.attemptPercent !== undefined && c.theoryCheck.status !== 'not_attempted' && (c.theoryCheck.attemptPercent >= 60) !== (c.theoryCheck.status === 'passed'))) || !same(lab.requiredConceptIds, required) || !same(lab.missingConceptIds, missing) || lab.ready !== !missing.length) ctx.addIssue({ code:'custom', message:'Progress and lab prerequisites disagree.' });
}) satisfies z.ZodType<ChapterProgress>;
export const ChapterEnvelope = z.object({ chapter: ChapterSchema });
export const LessonEnvelope = z.object({ lesson: LessonSchema });
export const ProgressEnvelope = z.object({ progress: ProgressSchema });
export const PositionEnvelope = z.object({ position: ConceptProgressSchema });
export const SavedPositionsSchema = z.object({ schema: z.literal('learning-positions/v1'), ownerLearnerId: z.string(), positions: z.record(z.string(), Position) });
export type SavedPositions = z.infer<typeof SavedPositionsSchema>['positions'];
