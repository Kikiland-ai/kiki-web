// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createFixtureLearning } from '../../fixtures/learning';
import { createFixtureAssessments } from '../../fixtures/assessments';
import bank from '../../fixtures/assessment-bank.json';
import { nextConceptId } from './nextConcept';
const requireUid = () => 'unit-student';
const plan = 'LP-ANALOG-MODULATION';
beforeEach(() => localStorage.clear());
function services() { const checks = createFixtureAssessments(requireUid); return { checks, api: createFixtureLearning(requireUid,checks) }; }
async function evaluate(checks: ReturnType<typeof createFixtureAssessments>, assessmentId: string, count=3) {
  const run = await checks.start(assessmentId);
  const questions = bank.sets.find(s => s.assessmentId === assessmentId)!.questions;
  await checks.submit(run.runId,{ responses: questions.map((q,i) => ({ questionId:q.questionId, optionIndex:i<count ? q.correctIndex : (q.correctIndex+1)%q.options.en.length })) });
}
describe('integrated next concept uses existing quiz history', () => {
  it('starts at C-AM-01 without seeded passes',async () => {
    const {api} = services(); expect(nextConceptId(await api.getChapter(plan),await api.getProgress(plan))).toBe('C-AM-01');
  });
  it('prefers a concept the student has started without marking it passed',async () => {
    const {api} = services(); await api.savePosition('C-AM-09','CARD-AM-09-concept');
    expect(nextConceptId(await api.getChapter(plan),await api.getProgress(plan))).toBe('C-AM-09');
  });
  it('prefers revisiting a failed required concept',async () => {
    const {api,checks} = services(); await evaluate(checks,'AS-AM-01',2);
    expect(nextConceptId(await api.getChapter(plan),await api.getProgress(plan))).toBe('C-AM-01');
  });
  it('moves to C-AM-05 once the seven lab checks pass',async () => {
    const {api,checks} = services(); for (const n of ['01','02','03','04','06','07','08']) await evaluate(checks,'AS-AM-'+n);
    const progress=await api.getProgress(plan); expect(progress.labReadiness?.ready).toBe(true);
    expect(nextConceptId(await api.getChapter(plan),progress)).toBe('C-AM-05');
  });
});
