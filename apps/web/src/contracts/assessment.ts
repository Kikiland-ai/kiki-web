import { z } from 'zod';
import type { AssessmentRun, QuizResult } from './api';
import { ASSESSMENT_CONCEPTS } from './assessment-catalog';
const Text = z.object({ en: z.string().min(1), or: z.string().min(1) });
const Choice = z.object({ questionId: z.string().min(1), optionIndex: z.number().int().nonnegative() });
export const QuestionSchema = z.object({ questionId: z.string().min(1), conceptId: z.string().min(1), prompt: Text, options: z.object({ en: z.array(z.string()).min(2), or: z.array(z.string()).min(2) }) }).refine(q => q.options.en.length === q.options.or.length, 'Languages must have equivalent option counts.');
export const RunSchema = z.object({
  ownerLearnerId: z.string().min(1), runId: z.string().min(1), assessmentId: z.string().min(1),
  scope: z.enum(['concept', 'chapter']), attemptNumber: z.number().int().positive(), passPercent: z.union([z.literal(60), z.literal(80)]),
  questions: z.array(QuestionSchema), contentVersion: z.string().min(1), revision: z.number().int().nonnegative(), status: z.enum(['in_progress', 'submitted']),
  responses: z.array(Choice), currentQuestionIndex: z.number().int().nonnegative(), origin: z.enum(['student_attempt', 'preview_setup']), createdAt: z.string().datetime(),
}).superRefine((run, ctx) => {
  const total = run.scope === 'concept' ? 5 : 10;
  if (run.questions.length !== total || run.passPercent !== (run.scope === 'concept' ? 60 : 80)) ctx.addIssue({ code: 'custom', message: 'Wrong assessment size or passing threshold.' });
  if (new Set(run.questions.map(q => q.questionId)).size !== total || run.currentQuestionIndex >= total) ctx.addIssue({ code: 'custom', message: 'Invalid assignment or position.' });
  if (run.scope === 'chapter' && new Set(run.questions.map(q => q.conceptId)).size !== 10) ctx.addIssue({ code: 'custom', message: 'The chapter check must cover ten concepts.' });
  try { checkResponses(run, run.responses, run.status === 'submitted'); } catch { ctx.addIssue({ code: 'custom', message: 'Invalid saved responses.' }); }
}) satisfies z.ZodType<AssessmentRun>;
export const ResultSchema = z.object({
  ownerLearnerId: z.string().min(1), contentVersion: z.string().min(1), runId: z.string().min(1), assessmentId: z.string().min(1),
  correct: z.number().int().nonnegative(), total: z.union([z.literal(5), z.literal(10)]), percent: z.number().min(0).max(100), passPercent: z.union([z.literal(60), z.literal(80)]), passed: z.boolean(),
  byConcept: z.record(z.string(), z.object({ correct: z.number().int().nonnegative(), total: z.number().int().positive(), missedQuestionIds: z.array(z.string()) })),
  revisitConceptIds: z.array(z.string()), nextAction: z.enum(['continue', 'revisit_then_retry']),
  feedback: z.array(z.object({ questionId: z.string(), correct: z.boolean(), explanation: Text })), completedAt: z.string().datetime(),
}).superRefine((r, ctx) => {
  if (r.correct > r.total || r.passPercent !== (r.total === 5 ? 60 : 80) || r.passed !== (r.correct * 100 >= r.passPercent * r.total) || Math.abs(r.percent - r.correct / r.total * 100) > 1e-7 || r.nextAction !== (r.passed ? 'continue' : 'revisit_then_retry')) ctx.addIssue({ code: 'custom', message: 'Inconsistent assessment score.' });
  if (r.feedback.length !== r.total || new Set(r.feedback.map(q => q.questionId)).size !== r.total || r.feedback.filter(f => f.correct).length !== r.correct) ctx.addIssue({ code: 'custom', message: 'Incomplete result feedback.' });
  const rows = Object.values(r.byConcept);
  if (rows.reduce((n,c) => n+c.correct,0) !== r.correct || rows.reduce((n,c) => n+c.total,0) !== r.total || rows.some(c => c.correct > c.total || c.missedQuestionIds.length !== c.total-c.correct)) ctx.addIssue({ code: 'custom', message: 'Inconsistent concept breakdown.' });
}) satisfies z.ZodType<QuizResult>;
export const OverviewSchema = z.object({
  ownerLearnerId: z.string(), planId: z.string(), contentVersion: z.string(),
  concepts: z.array(z.object({ conceptId: z.string(), assessmentId: z.string(), title: z.string(), status: z.enum(['not_attempted','passed','revisit']), latestRunId: z.string().nullable(), percent: z.number().nullable() })),
  chapterAllowed: z.boolean(), chapterMissingConceptIds: z.array(z.string()),
  labReady: z.boolean(), labMissingConceptIds: z.array(z.string()), chapterTestRequired: z.literal(false),
  attempts: z.array(z.object({ run: RunSchema, result: ResultSchema.nullable() })),
}).superRefine((o, ctx) => {
  if (o.concepts.length !== 10 || o.concepts.some(c => !ASSESSMENT_CONCEPTS.some(a => a.id === c.conceptId && a.assessmentId === c.assessmentId))) ctx.addIssue({ code: 'custom', message: 'Invalid concept overview.' });
  const missing = o.concepts.filter(c => c.status !== 'passed').map(c => c.conceptId);
  const labMissing = missing.filter(id => ASSESSMENT_CONCEPTS.some(c => c.id === id && c.requiredForLab));
  const same = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));
  if (new Set(o.concepts.map(c => c.conceptId)).size !== 10 || o.chapterAllowed !== !missing.length || !same(missing, o.chapterMissingConceptIds) || o.labReady !== !labMissing.length || !same(labMissing, o.labMissingConceptIds)) ctx.addIssue({ code: 'custom', message: 'Inconsistent prerequisite readiness.' });
  if (o.attempts.some(a => a.run.ownerLearnerId !== o.ownerLearnerId || (a.result && (a.result.ownerLearnerId !== o.ownerLearnerId || a.result.runId !== a.run.runId)))) ctx.addIssue({ code: 'custom', message: 'History ownership mismatch.' });
  try { o.attempts.forEach(a => { if (a.result) checkResultForRun(a.run,a.result); }); } catch { ctx.addIssue({ code: 'custom', message: 'History result does not match its assignment.' }); }
});
export type AssessmentOverview = z.infer<typeof OverviewSchema>;
export interface DraftUpdate { responses: AssessmentRun['responses']; currentQuestionIndex: number; expectedRevision: number }
export const RunEnvelope = z.object({ run: RunSchema });
export const ResultEnvelope = z.object({ result: ResultSchema });
export const OverviewEnvelope = z.object({ overview: OverviewSchema });
export function checkResponses(run: Pick<AssessmentRun, 'questions'>, responses: AssessmentRun['responses'], complete = false) {
  if (new Set(responses.map(r => r.questionId)).size !== responses.length || (complete && responses.length !== run.questions.length)) throw new Error('Answer each assigned question once.');
  for (const r of responses) {
    const question = run.questions.find(q => q.questionId === r.questionId);
    if (!question || !Number.isInteger(r.optionIndex) || r.optionIndex < 0 || r.optionIndex >= question.options.en.length) throw new Error('Invalid option or question.');
  }
}
export function sameResponses(a: AssessmentRun['responses'], b: AssessmentRun['responses']) { return a.length === b.length && a.every(r => b.some(other => other.questionId === r.questionId && other.optionIndex === r.optionIndex)); }
export function checkResultForRun(run: AssessmentRun, result: QuizResult) {
  if (result.ownerLearnerId !== run.ownerLearnerId || result.runId !== run.runId || result.assessmentId !== run.assessmentId || result.contentVersion !== run.contentVersion || result.total !== run.questions.length || result.passPercent !== run.passPercent) throw new Error('Result does not match this assignment.');
  if (result.feedback.some(f => !run.questions.some(q => q.questionId === f.questionId))) throw new Error('Result refers to another question set.');
  for (const [id,row] of Object.entries(result.byConcept)) {
    const questions = run.questions.filter(q => q.conceptId === id);
    if (questions.length !== row.total || row.missedQuestionIds.some(qid => !questions.some(q => q.questionId === qid))) throw new Error('Concept breakdown does not match the assignment.');
  }
}
