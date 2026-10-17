/* Pure domain rules. No authentication provider, database, screen capture or Simulink adapter. */
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function questionIndex(ledger) {
  return new Map(ledger.concepts.flatMap(c => c.checks.map(q => [q.id, { ...q, conceptId: c.id }])));
}
function assessments(caseData) {
  return [...caseData.assessments.concepts, caseData.assessments.chapter];
}
function scoreQuiz(caseData, ledger, run) {
  const set = assessments(caseData).find(s => s.id === run.assessmentId);
  assert(set, 'Unknown assessment');
  assert(Number.isInteger(run.attemptNumber) && run.attemptNumber > 0, 'Invalid attempt number');
  assert(Number.isFinite(Date.parse(run.completedAt)), 'Invalid completion time');
  assert(run.responses.length === set.questionIds.length, 'Incomplete quiz submission');
  const seen = new Set(), questions = questionIndex(ledger), byConcept = {};
  let correct = 0;
  for (const response of run.responses) {
    assert(set.questionIds.includes(response.questionId), 'Question is outside this assessment');
    assert(!seen.has(response.questionId), 'Duplicate question response');
    seen.add(response.questionId);
    const q = questions.get(response.questionId);
    assert(q && q.type === 'mcq' && q.dimension === 'concept', 'Assessment must reference concept MCQs');
    assert(Number.isInteger(response.optionIndex) && response.optionIndex >= 0 && response.optionIndex < q.options.length, 'Invalid option index');
    const right = response.optionIndex === q.options.indexOf(q.answer);
    const row = byConcept[q.conceptId] ||= { correct: 0, total: 0, missedQuestionIds: [] };
    row.total++;
    if (right) { correct++; row.correct++; } else row.missedQuestionIds.push(q.id);
  }
  const total = set.questionIds.length;
  // Compare unrounded counts: a rounded percentage must never make a failing score pass.
  const passed = correct * 100 >= set.passPercent * total;
  return {
    correct, total, percent: correct / total * 100, passPercent: set.passPercent, passed,
    label: 'correctness_on_this_attempt', byConcept,
    revisitConceptIds: Object.entries(byConcept).filter(([, v]) => v.correct < v.total).map(([id]) => id),
    nextAction: passed ? 'continue' : 'revisit_then_retry',
    languageAssessment: 'not_measured_by_bilingual_mcqs'
  };
}

function requiredConceptReadiness(caseData, ledger, learnerId, quizRuns) {
  const latest = new Map();
  for (const run of quizRuns.filter(r => r.learnerId === learnerId)) {
    const set = caseData.assessments.concepts.find(s => s.id === run.assessmentId);
    if (!set) continue; // Chapter and optional language tasks are not lab-entry evidence.
    const result = scoreQuiz(caseData, ledger, run);
    const previous = latest.get(set.conceptIds[0]);
    if (!previous || Date.parse(run.completedAt) > Date.parse(previous.run.completedAt) ||
        (Date.parse(run.completedAt) === Date.parse(previous.run.completedAt) && run.attemptNumber > previous.run.attemptNumber)) {
      latest.set(set.conceptIds[0], { run, result });
    }
  }
  const required = caseData.practical.requiredConceptIds;
  return {
    ready: required.every(id => latest.get(id)?.result.passed),
    missingOrRevisitConceptIds: required.filter(id => !latest.get(id)?.result.passed),
    evidenceQuizRunIds: required.flatMap(id => latest.has(id) ? [latest.get(id).run.id] : []),
    chapterTestRequired: false
  };
}

function pointerActivation(caseData, ledger, session, quizRuns) {
  const reasons = [];
  if (session.practicalId !== caseData.practicalId) reasons.push('wrong_experiment');
  if (!session.experimentSelected) reasons.push('experiment_not_selected');
  if (!requiredConceptReadiness(caseData, ledger, session.ownerLearnerId, quizRuns).ready) reasons.push('required_concepts_not_passed');
  if (!session.software.opened) reasons.push('software_not_opened');
  if (!session.software.workspaceConfirmed) reasons.push('workspace_not_confirmed');
  if (!session.connection.consentGranted) reasons.push('observation_not_enabled');
  if (session.connection.state !== 'active') reasons.push('connection_not_active');
  if (session.status !== 'active') reasons.push('session_not_active');
  if (!session.controllingDeviceId) reasons.push('no_controlling_device');
  return { active: reasons.length === 0, reasons, performsStudentActions: false };
}

function verifiedCheckpointIds(session) {
  return [...new Set(session.evidence.filter(e => e.verdict === 'verified' && e.source !== 'student_report').map(e => e.checkpointId))];
}

function transferSession(caseData, ledger, session, handoff, actor, quizRuns, now) {
  assert(actor.authenticated === true, 'Sign-in required');
  assert(actor.learnerId === session.ownerLearnerId && actor.learnerId === handoff.ownerLearnerId, 'Session owner mismatch');
  assert(handoff.labSessionId === session.id, 'Handoff references another session');
  assert(Number.isFinite(Date.parse(handoff.expiresAt)) && Date.parse(handoff.expiresAt) > Date.parse(now), 'Handoff expired');
  assert(handoff.fromDeviceId === session.controllingDeviceId, 'Controlling device changed');
  assert(handoff.toDeviceId !== handoff.fromDeviceId, 'Destination must be another device');
  assert(handoff.savedRevision === session.revision && session.lastSyncedRevision === session.revision, 'Unsynced or stale handoff');
  assert(session.status !== 'completed', 'Completed session cannot transfer execution control');
  if (session.software.opened) assert(session.software.projectSaved && session.software.projectRef, 'Save the external model before transferring');
  const next = structuredClone(session);
  next.controllingDeviceId = handoff.toDeviceId;
  next.observerDeviceIds = [...new Set([...next.observerDeviceIds, handoff.fromDeviceId])].filter(id => id !== handoff.toDeviceId);
  // The destination must reopen and confirm its own workspace; never reuse old screen permission.
  next.software.opened = false;
  next.software.workspaceConfirmed = false;
  next.connection.state = 'inactive';
  next.connection.consentGranted = false;
  next.status = requiredConceptReadiness(caseData, ledger, actor.learnerId, quizRuns).ready ? 'ready' : 'preparing';
  next.revision++;
  next.lastSyncedRevision = next.revision;
  next.updatedAt = now;
  return next; // The server adapter must persist atomically with the expected original revision.
}

module.exports = { questionIndex, assessments, scoreQuiz, requiredConceptReadiness, pointerActivation, verifiedCheckpointIds, transferSession };
