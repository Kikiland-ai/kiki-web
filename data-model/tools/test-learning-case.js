const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const load = () => ({
  C: JSON.parse(fs.readFileSync(path.join(root, 'cases/analog-modulation-odia.json'))),
  L: JSON.parse(fs.readFileSync(path.join(root, 'ledgers/electronics/analog-modulation.json')))
});
const rules = require('../runtime/learning-case'), { validateCase } = require('../validate-case');

test('full case passes references and bilingual completeness', () => {
  const { C, L } = load(); assert.deepEqual(validateCase(C, L), []);
});
test('2/5 revisits and 3/5 passes a concept', () => {
  const { C, L } = load();
  const fail = rules.scoreQuiz(C, L, C.seeds.quizRuns[0]);
  const pass = rules.scoreQuiz(C, L, C.seeds.quizRuns[1]);
  assert.equal(fail.percent, 40); assert.equal(fail.passed, false);
  assert.equal(pass.percent, 60); assert.equal(pass.passed, true);
});
test('7/10 fails and 8/10 passes the chapter', () => {
  const { C, L } = load();
  assert.equal(rules.scoreQuiz(C, L, C.seeds.scoreExamples[0]).passed, false);
  const pass = rules.scoreQuiz(C, L, C.seeds.scoreExamples[1]);
  assert.equal(pass.percent, 80); assert.equal(pass.passed, true);
  assert.equal(pass.languageAssessment, 'not_measured_by_bilingual_mcqs');
});
test('chapter quiz covers all ten concepts with distinct questions', () => {
  const { C, L } = load(), q = rules.questionIndex(L);
  assert.equal(new Set(C.assessments.chapter.questionIds.map(id => q.get(id).conceptId)).size, 10);
  const practice = new Set(C.assessments.concepts.flatMap(a => a.questionIds));
  assert(C.assessments.chapter.questionIds.every(id => !practice.has(id)));
});
test('choice scoring rejects unknown assessments and foreign questions', () => {
  const { C, L } = load(); const run = C.seeds.quizRuns[1];
  assert.throws(() => rules.scoreQuiz(C,L,{...run,assessmentId:'unknown'}), /Unknown assessment/);
  run.responses[0].questionId='Q-AM-10-6';
  assert.throws(() => rules.scoreQuiz(C,L,run), /outside this assessment/);
});
test('duplicate responses cannot pad an attempt to pass', () => {
  const { C, L }=load(), run=C.seeds.quizRuns[1];
  run.responses[1]=run.responses[0];
  assert.throws(() => rules.scoreQuiz(C,L,run), /Duplicate/);
});
test('unfinished submissions and invalid choices do not count as passes', () => {
  const { C, L }=load(), run=C.seeds.quizRuns[1];
  assert.throws(() => rules.scoreQuiz(C,L,{...run,responses:run.responses.slice(1)}), /Incomplete/);
  run.responses[0].optionIndex=99;
  assert.throws(() => rules.scoreQuiz(C,L,run), /Invalid option/);
});
test('lab entry needs only seven required concept passes, not chapter or FM/PM', () => {
  const { C, L }=load();
  assert(C.seeds.quizRuns.every(r => r.assessmentId !== C.assessments.chapter.id));
  const readiness=rules.requiredConceptReadiness(C,L,C.seeds.learner.id,C.seeds.quizRuns);
  assert.equal(readiness.ready,true); assert.equal(readiness.chapterTestRequired,false);
  assert.equal(readiness.evidenceQuizRunIds.length,7);
});
test('another learner’s quiz history cannot unlock the lab', () => {
  const { C, L }=load();
  assert.equal(rules.requiredConceptReadiness(C,L,'OTHER-STUDENT',C.seeds.quizRuns).ready,false);
});
test('a later failed required concept requires a revisit', () => {
  const { C,L }=load(); const failed=structuredClone(C.seeds.quizRuns[0]);
  failed.id='LATER-FAIL'; failed.attemptNumber=3; failed.completedAt='2026-10-12T13:30:00+05:30';
  const r=rules.requiredConceptReadiness(C,L,C.seeds.learner.id,[...C.seeds.quizRuns,failed]);
  assert.equal(r.ready,false); assert.deepEqual(r.missingOrRevisitConceptIds,['C-AM-01']);
});
test('self-ratings and ring values cannot unlock missing concept checks', () => {
  const { C,L }=load();
  C.seeds.learner.onboarding.fluencySelfRatings.englishOutOf10=10;
  C.seeds.conceptStates.forEach(s => { s.dims.concept.score=1; });
  assert.equal(rules.requiredConceptReadiness(C,L,C.seeds.learner.id,[]).ready,false);
});
test('opening tracker or selecting experiment does not activate pointer', () => {
  const { C,L }=load();
  assert.equal(rules.pointerActivation(C,L,C.seeds.labSessions[0],C.seeds.quizRuns).active,false);
});
test('confirmed synthetic active workspace meets pointer policy', () => {
  const { C,L }=load();
  const r=rules.pointerActivation(C,L,C.seeds.labSessions[1],C.seeds.quizRuns);
  assert.equal(r.active,true); assert.equal(r.performsStudentActions,false);
});
for (const [name, mutate] of [
  ['experiment missing',s=>{s.experimentSelected=false;}],
  ['software closed',s=>{s.software.opened=false;}],
  ['workspace unconfirmed',s=>{s.software.workspaceConfirmed=false;}],
  ['connection lost',s=>{s.connection.state='disconnected';s.status='disconnected';}],
  ['observation disabled',s=>{s.connection.consentGranted=false;}],
  ['paused session',s=>{s.status='paused';}],
  ['completed session',s=>{s.status='completed';}]
]) test('pointer stays off when '+name,()=>{
  const { C,L }=load(), session=C.seeds.labSessions[1]; mutate(session);
  assert.equal(rules.pointerActivation(C,L,session,C.seeds.quizRuns).active,false);
});
test('self-reported completion does not fill verified lab progress',()=>{
  const { C }=load(),session=C.seeds.labSessions[0];
  session.evidence=[
    {id:'E1',checkpointId:'CP-DSB-01',source:'student_report',verdict:'verified'},
    {id:'E2',checkpointId:'CP-DSB-02',source:'integration',verdict:'verified'},
    {id:'E3',checkpointId:'CP-DSB-03',source:'screenshot_review',verdict:'needs_review'}
  ];
  assert.deepEqual(rules.verifiedCheckpointIds(session),['CP-DSB-02']);
});
test('phone preparation transfers to laptop without needing an uncreated external model',()=>{
  const { C,L }=load(), original=C.seeds.labSessions[0];
  const next=rules.transferSession(C,L,original,C.seeds.handoffs[0],{authenticated:true,learnerId:C.seeds.learner.id},C.seeds.quizRuns,'2026-10-12T13:00:00+05:30');
  assert.equal(next.id,original.id);assert.equal(next.controllingDeviceId,'DEVICE-LAPTOP');
  assert.deepEqual(next.observerDeviceIds,['DEVICE-PHONE']);
  assert.equal(next.status,'ready');assert.equal(next.connection.state,'inactive');
  assert.equal(next.software.workspaceConfirmed,false);assert.equal(original.controllingDeviceId,'DEVICE-PHONE');
});
test('handoff locator does not authorize another user or anonymous visitor',()=>{
  const { C,L }=load(), s=C.seeds.labSessions[0],h=C.seeds.handoffs[0];
  assert.throws(()=>rules.transferSession(C,L,s,h,{authenticated:false,learnerId:s.ownerLearnerId},C.seeds.quizRuns,'2026-10-12T13:00:00+05:30'),/Sign-in/);
  assert.throws(()=>rules.transferSession(C,L,s,h,{authenticated:true,learnerId:'OTHER'},C.seeds.quizRuns,'2026-10-12T13:00:00+05:30'),/owner/);
});
test('stale and expired handoffs are rejected',()=>{
  const { C,L }=load(),s=C.seeds.labSessions[0],h=C.seeds.handoffs[0],actor={authenticated:true,learnerId:s.ownerLearnerId};
  assert.throws(()=>rules.transferSession(C,L,s,h,actor,C.seeds.quizRuns,'2026-10-12T15:00:00+05:30'),/expired/);
  s.revision=2;
  assert.throws(()=>rules.transferSession(C,L,s,h,actor,C.seeds.quizRuns,'2026-10-12T13:00:00+05:30'),/stale/);
});
test('opened external model must be saved before device transfer',()=>{
  const { C,L }=load(),s=C.seeds.labSessions[0],h=C.seeds.handoffs[0],actor={authenticated:true,learnerId:s.ownerLearnerId};
  s.software.opened=true;
  assert.throws(()=>rules.transferSession(C,L,s,h,actor,C.seeds.quizRuns,'2026-10-12T13:00:00+05:30'),/Save the external model/);
});
test('case validator catches missing Odia choices, wrong colours and a lowered chapter threshold',()=>{
  const { C,L }=load();
  C.questionTranslations[0].options.pop(); C.ui.colours.concept='blue'; C.assessments.chapter.passPercent=60;
  const errors=validateCase(C,L);
  assert(errors.some(e=>e.includes('option count'))); assert(errors.some(e=>e.includes('colours'))); assert(errors.some(e=>e.includes('80%')));
});
test('case validator catches missing lab prerequisite ancestors',()=>{
  const { C,L }=load();
  C.practical.requiredConceptIds=C.practical.requiredConceptIds.filter(id=>id!=='C-AM-01');
  assert(validateCase(C,L).some(e=>e.includes('ancestor')));
});
test('filter prediction independently matches the authored baseline',()=>{
  const { C }=load(),p=C.practical.simulation,[a,b,c]=p.lowpass.denominator,n=p.lowpass.numerator[0],w=2*Math.PI*p.messageFrequencyHz;
  const mag=n/Math.hypot(c-a*w*w,b*w);
  const phase=Math.atan2(b*w,c-a*w*w)*180/Math.PI;
  assert(Math.abs(mag-p.expectations.steadyStateMessageAmplitude)<1e-12);
  assert(Math.abs(phase-p.expectations.filterPhaseLagDegrees)<1e-12);
  const wc=2*Math.PI*p.lowpassCutoffHz;
  assert(Math.abs(n/Math.hypot(c-a*wc*wc,b*wc)-1/Math.sqrt(2))<1e-12);
  assert.deepEqual(p.expectations.idealSidebandsHz,[p.carrierFrequencyHz-p.messageFrequencyHz,p.carrierFrequencyHz+p.messageFrequencyHz]);
  assert(Math.abs(Math.cos(p.expectations.phaseFaultOffsetDegrees*Math.PI/180))<1e-12);
  assert(p.maxStepSec <= 1/(50*p.carrierFrequencyHz));
});
