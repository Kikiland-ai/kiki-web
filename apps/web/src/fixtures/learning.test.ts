// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createFixtureLearning } from './learning';
import { createFixtureAssessments } from './assessments';
import bank from './assessment-bank.json';
import { LessonSchema, ProgressSchema } from '../contracts/learning';
import { COURSE } from '../contracts/profile';
let uid = 'student-a';
const requireUid = () => uid;
beforeEach(() => { uid = 'student-a'; localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());
function harness() { const assessments = createFixtureAssessments(requireUid); return { assessments, api: createFixtureLearning(requireUid, assessments) }; }
async function score(assessments: ReturnType<typeof createFixtureAssessments>, assessmentId: string, count: number) {
  const run = await assessments.start(assessmentId);
  const keys = bank.sets.find(s => s.assessmentId === assessmentId)!.questions;
  await assessments.submit(run.runId, { responses: keys.map((q,i) => ({ questionId:q.questionId, optionIndex: i<count ? q.correctIndex : (q.correctIndex+1)%q.options.en.length })) });
}
it('starts unassessed, validates all ten lessons, and reading grants no passes',async () => {
  const {api}=harness(); const chapter=await api.getChapter(COURSE.chapterId);
  for(const c of chapter.concepts) expect((await api.getConceptLesson(c.id)).placards).toHaveLength(4);
  const first=await api.getProgress(COURSE.chapterId);
  expect(first.concepts.every(c=>c.status==='not_started')).toBe(true); expect(first.rings.concept).toBeNull();
  await api.savePosition('C-AM-01','CARD-AM-01-concept');
  const read=await api.getProgress(COURSE.chapterId);
  expect(read.concepts[0].status).toBe('learning'); expect(read.rings.concept).toBeNull();
  expect(read.labReadiness?.missingConceptIds).toHaveLength(7);
});
it('uses the same latest quiz evidence for 2/5 revisit, 3/5 pass and a later failed retry',async () => {
  const {api,assessments}=harness();
  for(const [count,status] of [[2,'revisit'],[3,'passed'],[2,'revisit']] as const) {
    await score(assessments,'AS-AM-01',count);
    const map=await api.getProgress(COURSE.chapterId), quiz=await assessments.overview(COURSE.chapterId);
    expect(map.concepts[0].status).toBe(status); expect(map.concepts[0].theoryCheck.latestRunId).toBe(quiz.concepts[0].latestRunId);
    expect(map.rings.concept).toEqual({done:status==='passed'?1:0,total:10});
  }
  expect((await assessments.overview(COURSE.chapterId)).attempts).toHaveLength(3);
});
it('seven lab prerequisites pass independently of the all-ten chapter gate',async () => {
  const {api,assessments}=harness();
  for(const n of ['01','02','03','04','06','07','08']) await score(assessments,'AS-AM-'+n,3);
  expect((await api.getProgress(COURSE.chapterId)).labReadiness).toMatchObject({ready:true,chapterTestRequired:false,missingConceptIds:[]});
  await expect(assessments.start('AS-AM-CHAPTER')).rejects.toThrow('all ten');
  for(const n of ['05','09','10']) await score(assessments,'AS-AM-'+n,3);
  await score(assessments,'AS-AM-CHAPTER',7); expect((await api.getProgress(COURSE.chapterId)).chapterTest.status).toBe('revisit');
  await score(assessments,'AS-AM-CHAPTER',8); expect((await api.getProgress(COURSE.chapterId)).chapterTest.status).toBe('passed');
});
it('reopens owned positions and never exposes them to another account',async () => {
  const {api,assessments}=harness(); await api.savePosition('C-AM-08','CARD-AM-08-concept');
  const reopened=createFixtureLearning(requireUid,assessments);
  expect((await reopened.getProgress(COURSE.chapterId)).concepts.find(c=>c.conceptId==='C-AM-08')?.position?.placardId).toBe('CARD-AM-08-concept');
  uid='student-b'; expect((await reopened.getProgress(COURSE.chapterId)).concepts.every(c=>!c.position)).toBe(true);
  uid='student-a'; await expect(api.savePosition('C-AM-08','CARD-AM-01-concept')).rejects.toThrow('does not belong');
});
it('preserves corrupt positions instead of silently resetting them',async () => {
  const {api}=harness(); const key='kiki:learning-positions:fixture:v1:student-a'; localStorage.setItem(key,'broken');
  await expect(api.getProgress(COURSE.chapterId)).rejects.toThrow('previous data was kept'); expect(localStorage.getItem(key)).toBe('broken');
});
it('surfaces failed writes without claiming a saved position',async () => {
  const {api}=harness(); vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  await expect(api.savePosition('C-AM-01','CARD-AM-01-concept')).rejects.toThrow('not saved');
});
it('rejects a late progress response after the account changes',async () => {
  const {api,assessments}=harness(); const overview=await assessments.overview(COURSE.chapterId);
  let finish: (value: typeof overview)=>void=()=>undefined;
  vi.spyOn(assessments,'overview').mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  const pending=api.savePosition('C-AM-01','CARD-AM-01-concept'); uid='student-b'; finish(overview);
  await expect(pending).rejects.toThrow('account changed'); expect(localStorage.getItem('kiki:learning-positions:fixture:v1:student-b')).toBeNull();
});

it('rejects a readiness claim that disagrees with concept evidence',async()=>{
  const {api}=harness(); const progress=await api.getProgress(COURSE.chapterId);
  expect(ProgressSchema.safeParse({...progress,labReadiness:{...progress.labReadiness,ready:true}}).success).toBe(false);
  const duplicated={...progress,concepts:progress.concepts.map((c,i)=>i===9?progress.concepts[0]:c)};
  expect(ProgressSchema.safeParse(duplicated).success).toBe(false);
});

it('only attaches the authored DSB visual to concept 4 with its existing glossary',async()=>{
  const {api}=harness();const lesson=await api.getConceptLesson('C-AM-04');
  expect(lesson.visual?.messageFrequencyHz).toBe(100);
  expect((await api.getConceptLesson('C-AM-01')).visual).toBeUndefined();
  expect(LessonSchema.safeParse({...lesson,conceptId:'C-AM-01',assessmentId:'AS-AM-01'}).success).toBe(false);
  expect(LessonSchema.safeParse({...lesson,terms:lesson.terms.filter(t=>t.id!=='T-AM-04-2')}).success).toBe(false);
});
