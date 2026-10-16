import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import bank from './assessment-bank.json';
import { createFixtureAssessments } from './assessments';
import type { AssessmentRun } from '../contracts/api';
import { COURSE } from '../contracts/profile';
import { CHAPTER_ASSESSMENT, ASSESSMENT_CONCEPTS } from '../contracts/assessment-catalog';
import { ResultSchema, checkResultForRun } from '../contracts/assessment';

const require = createRequire(import.meta.url);
const rules = require('../../../../data-model/runtime/learning-case.js') as { scoreQuiz(c: unknown,l: unknown,r: unknown): { correct: number; total: number; passed: boolean; percent: number } };
const caseData: unknown = require('../../../../data-model/cases/analog-modulation-odia.json');
const ledger: unknown = require('../../../../data-model/ledgers/electronics/analog-modulation.json');
beforeEach(() => {
  const values = new Map<string,string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value: string) => values.set(key,value), removeItem: (key: string) => values.delete(key) });
});
const responses = (run: AssessmentRun, correctCount: number) => run.questions.map((q,i) => {
  const key = bank.sets.find(s => s.assessmentId === run.assessmentId)!.questions.find(k => k.questionId === q.questionId)!;
  return { questionId: q.questionId, optionIndex: i < correctCount ? key.correctIndex : (key.correctIndex+1)%q.options.en.length };
});
describe('quiz assignment/draft/result preview boundary', () => {
  it.each([{id:'AS-AM-01',correct:2,passed:false},{id:'AS-AM-01',correct:3,passed:true},{id:CHAPTER_ASSESSMENT,correct:7,passed:false},{id:CHAPTER_ASSESSMENT,correct:8,passed:true}])('matches shared domain policy for $correct correct on $id', async ({id,correct,passed}) => {
    const api = createFixtureAssessments(() => 'student-a');
    if (id === CHAPTER_ASSESSMENT) await api.previewChapterReady!();
    const run = await api.start(id), answers = responses(run,correct);
    const result = await api.submit(run.runId,{responses:answers});
    const baseline = rules.scoreQuiz(caseData,ledger,{assessmentId:id,responses:answers,attemptNumber:run.attemptNumber,completedAt:result.completedAt});
    expect(result.passed).toBe(passed); expect(result.correct).toBe(baseline.correct); expect(result.total).toBe(baseline.total); expect(result.percent).toBe(baseline.percent); expect(result.passed).toBe(baseline.passed);
  });
  it('resumes an assignment, persists a revisioned draft and never sends keys in public run data', async () => {
    const api = createFixtureAssessments(() => 'student-a');
    const run = await api.start('AS-AM-01',undefined,'start-one');
    expect((await api.start('AS-AM-01',undefined,'start-one')).runId).toBe(run.runId);
    expect((await api.start('AS-AM-01',undefined,'different-key')).runId).toBe(run.runId);
    const selected = responses(run,5).slice(0,2);
    const saved = await api.saveDraft(run.runId,{responses:selected,currentQuestionIndex:1,expectedRevision:0});
    expect(saved.revision).toBe(1); expect((await api.get(run.runId)).responses).toEqual(selected);
    await expect(api.saveDraft(run.runId,{responses:[],currentQuestionIndex:0,expectedRevision:0})).rejects.toThrow('draft changed');
    expect(JSON.stringify(saved)).not.toContain('correctIndex'); expect(JSON.stringify(saved)).not.toContain('"explanation"');
  });
  it('rejects incomplete/foreign/invalid choices, duplicate grading and edits to submitted attempts', async () => {
    const api = createFixtureAssessments(() => 'student-a'); const run = await api.start('AS-AM-01'); const selected = responses(run,3);
    await expect(api.submit(run.runId,{responses:selected.slice(0,2)})).rejects.toThrow('each assigned question');
    await expect(api.saveDraft(run.runId,{responses:[{questionId:'foreign',optionIndex:0}],currentQuestionIndex:0,expectedRevision:0})).rejects.toThrow('Invalid option or question');
    await expect(api.saveDraft(run.runId,{responses:[{questionId:run.questions[0].questionId,optionIndex:99}],currentQuestionIndex:0,expectedRevision:0})).rejects.toThrow('Invalid option or question');
    const result = await api.submit(run.runId,{responses:selected});
    expect(await api.submit(run.runId,{responses:[...selected].reverse()})).toEqual(result);
    await expect(api.submit(run.runId,{responses:responses(run,5)})).rejects.toThrow('cannot be changed');
    expect((await api.overview(COURSE.chapterId)).attempts).toHaveLength(1);
    expect(ResultSchema.safeParse({...result,passed:false} ).success).toBe(false);
    expect(() => checkResultForRun(run,{...result,feedback:result.feedback.map((f,i) => i ? f : {...f,questionId:'foreign'})})).toThrow('another question set');
  });
  it('requires ten passed checks for chapter entry, but only seven for the lab and never fills English/words/lab evidence', async () => {
    const api = createFixtureAssessments(() => 'student-a');
    await expect(api.start(CHAPTER_ASSESSMENT)).rejects.toThrow('all ten');
    for (const concept of ASSESSMENT_CONCEPTS.filter(c => c.requiredForLab)) { const run = await api.start(concept.assessmentId); await api.submit(run.runId,{responses:responses(run,3)}); }
    const overview = await api.overview(COURSE.chapterId);
    expect(overview.labReady).toBe(true); expect(overview.chapterAllowed).toBe(false); expect(overview.chapterTestRequired).toBe(false); expect(overview.chapterMissingConceptIds).toHaveLength(3);
  });
  it('uses the latest completed concept attempt and keeps earlier results', async () => {
    const api = createFixtureAssessments(() => 'student-a');
    const first = await api.start('AS-AM-01'); await api.submit(first.runId,{responses:responses(first,3)});
    const second = await api.start('AS-AM-01',undefined,'retry-one',first.runId); await api.submit(second.runId,{responses:responses(second,2)});
    const overview = await api.overview(COURSE.chapterId);
    expect(overview.concepts[0].status).toBe('revisit'); expect(overview.attempts).toHaveLength(2);
  });
  it('does not expose another owner’s attempts after switching accounts', async () => {
    let uid = 'student-a'; const api = createFixtureAssessments(() => uid);
    const run = await api.start('AS-AM-01'); uid = 'student-b';
    await expect(api.get(run.runId)).rejects.toThrow('could not be found');
    expect((await api.overview(COURSE.chapterId)).attempts).toEqual([]);
  });
});
