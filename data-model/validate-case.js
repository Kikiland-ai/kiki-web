#!/usr/bin/env node
/* Validates the referenced ledger and the additional learning-case contracts. */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const rules = require('./runtime/learning-case');

function validateCase(caseData, ledger) {
  const errors = [], check = (ok, message) => { if (!ok) errors.push(message); };
  check(caseData.schema === 'learning-case/v1', 'Unknown learning-case schema');
  check(caseData.courseId === ledger.course.id, 'Course reference mismatch');
  check(caseData.lessonPlanId === ledger.lessonPlan.id, 'Chapter reference mismatch');
  const concepts = new Map(ledger.concepts.map(c => [c.id, c]));
  const terms = new Map(ledger.terms.map(t => [t.id, t]));
  const questions = rules.questionIndex(ledger);
  const practical = ledger.practicals.find(p => p.id === caseData.practicalId);
  check(Boolean(practical), 'Missing practical reference');
  const unique = (items, label) => check(new Set(items).size === items.length, 'Duplicate ' + label);
  const translated = new Map(caseData.questionTranslations.map(t => [t.questionId, t]));
  unique(caseData.questionTranslations.map(t => t.questionId), 'question translation');
  for (const [id, q] of questions) {
    const t = translated.get(id);
    check(Boolean(t && t.language === 'or' && t.prompt && t.explanation), id + ': missing Odia prompt/feedback');
    if (q.options) check(t?.options?.length === q.options.length, id + ': translated option count mismatch');
  }
  for (const id of translated.keys()) check(questions.has(id), 'Translation references unknown question ' + id);
  for (const term of terms.values()) check(Boolean(term.glosses?.or && term.pronunciations?.or), term.id + ': missing Odia meaning/pronunciation');
  unique(caseData.glossaryExamples.map(t => t.termId), 'glossary example');
  for (const term of terms.values()) check(caseData.glossaryExamples.some(t => t.termId === term.id && t.sentence.en && t.sentence.or), term.id + ': missing bilingual example');
  unique(caseData.placards.map(c => c.id), 'placard id');
  for (const c of concepts.values()) {
    const cards = caseData.placards.filter(p => p.conceptId === c.id);
    check(cards.length === 4 && ['definition','concept','application','recap'].every(k => cards.filter(p => p.kind === k).length === 1), c.id + ': needs four distinct placard kinds');
    check(caseData.conceptTranslations.filter(t => t.conceptId === c.id && t.explanation && t.example.scenario && t.workedQuestion.modelAnswer.length).length === 1, c.id + ': missing localized lesson/worked answer');
  }
  for (const p of caseData.placards) {
    check(concepts.has(p.conceptId), p.id + ': unknown concept');
    check(Boolean(p.title.en && p.title.or && p.body.en && p.body.or), p.id + ': missing bilingual placard');
    check(p.termIds.every(id => terms.has(id)), p.id + ': unknown glossary term');
  }
  unique(rules.assessments(caseData).map(s => s.id), 'assessment id');
  const practiceIds = new Set();
  for (const set of caseData.assessments.concepts) {
    check(set.scope === 'concept' && set.passPercent === 60 && set.maxQuestions === 5, set.id + ': concept policy must be 60% and maximum five');
    check(set.conceptIds.length === 1 && concepts.has(set.conceptIds[0]), set.id + ': unknown/multiple concept');
    check(set.questionIds.length >= 4 && set.questionIds.length <= 5, set.id + ': concept needs four/five questions');
    for (const id of set.questionIds) { practiceIds.add(id); check(questions.get(id)?.conceptId === set.conceptIds[0], set.id + ': question belongs to another concept'); }
  }
  check(caseData.assessments.concepts.length === concepts.size && new Set(caseData.assessments.concepts.flatMap(s => s.conceptIds)).size === concepts.size, 'Each concept needs one practice set');
  const chapter = caseData.assessments.chapter;
  check(chapter.scope === 'chapter' && chapter.passPercent === 80 && chapter.maxQuestions === 10 && chapter.questionIds.length === 10, 'Chapter needs ten questions and 80%');
  check(chapter.questionIds.every(id => !practiceIds.has(id)), 'Chapter questions must be separate from concept practice');
  const covered = new Set(chapter.questionIds.map(id => questions.get(id)?.conceptId));
  check([...concepts.keys()].every(id => covered.has(id)), 'Chapter test omits a concept');
  for (const set of rules.assessments(caseData)) {
    unique(set.questionIds, set.id + ' question');
    check(set.lessonPlanId === ledger.lessonPlan.id, set.id + ': wrong chapter');
    check(set.languageModes.join(',') === 'or,en', set.id + ': must support Odia and English');
    for (const id of set.questionIds) check(questions.get(id)?.type === 'mcq' && questions.get(id)?.dimension === 'concept', set.id + ': must use concept MCQs');
  }
  for (const id of caseData.assessments.auxiliaryQuestionIds) check(questions.has(id) && !practiceIds.has(id) && !chapter.questionIds.includes(id), 'Optional tasks must be separate from pass-scoring questions');
  if (caseData.assessments.englishRubricId) check(ledger.englishRubric?.id === caseData.assessments.englishRubricId && ledger.englishRubric.criteria.length > 0, 'Optional English task rubric is missing');
  check(JSON.stringify(caseData.ui.colours) === JSON.stringify({concept:'green',words:'red',english:'yellow',lab:'blue'}), 'Wrong mastery colours');
  check(caseData.ui.labEntry.placement === 'top_right' && caseData.ui.labEntry.pointerOnEntry === false, 'Lab entry must not immediately activate pointer');
  check(caseData.practical.entry.conceptPassPercent === 60 && caseData.practical.entry.chapterPassRequired === false, 'Wrong lab prerequisite gate');
  check(caseData.practical.practicalId === caseData.practicalId, 'Lab configuration reference mismatch');
  unique(caseData.practical.requiredConceptIds, 'lab prerequisite');
  for (const id of caseData.practical.requiredConceptIds) {
    check(concepts.has(id) && practical?.conceptIds.includes(id), 'Invalid lab prerequisite ' + id);
    for (const p of concepts.get(id)?.prerequisiteIds || []) check(caseData.practical.requiredConceptIds.includes(p), 'Lab gate misses ancestor ' + p);
  }
  check(practical?.conceptIds.length === caseData.practical.requiredConceptIds.length, 'Practical and lab-gate concept lists differ');
  const blocks = new Map(caseData.practical.blocks.map(b => [b.id, b]));
  unique([...caseData.practical.blocks.map(b => b.id)], 'model block');
  const usedInputs = new Set();
  for (const w of caseData.practical.connections) {
    check(blocks.has(w.fromBlockId) && blocks.has(w.toBlockId), 'Wire references missing block');
    const key = w.toBlockId + ':' + w.toPort;
    check(!usedInputs.has(key), 'Multiple drivers for ' + key); usedInputs.add(key);
    check(w.fromPort > 0 && w.toPort > 0, 'Invalid port number');
  }
  const cps = new Map(caseData.practical.checkpoints.map(c => [c.id, c]));
  unique(caseData.practical.checkpoints.map(c => c.id), 'checkpoint');
  for (const cp of cps.values()) {
    check(practical?.steps.some(s => s.n === cp.stepNumber), 'Checkpoint step is missing');
    check(Boolean(cp.instruction.en && cp.instruction.or && cp.why.en && cp.why.or && cp.expected), cp.id + ': missing bilingual step/reason');
    for (const id of cp.prerequisiteCheckpointIds) check(cps.has(id) && cps.get(id).stepNumber < cp.stepNumber, 'Checkpoint dependency is missing or cyclic');
  }
  const faults = new Set(practical?.faultCards.map(f => f.id));
  for (const f of caseData.practical.faultConfigurations) check(faults.has(f.faultCardId) && blocks.has(f.blockId), 'Invalid fault configuration');
  check(caseData.practical.pointer.performsStudentActions === false, 'Pointer may not perform student actions');
  for (const v of caseData.practical.viva) check(v.prompt.en && v.prompt.or && v.answer.en && v.answer.or && v.conceptIds.every(id => concepts.has(id)), 'Invalid bilingual viva');
  check(caseData.seeds.synthetic === true, 'Runtime fixtures must be explicitly synthetic');
  const learner = caseData.seeds.learner;
  const ratings = learner.onboarding.fluencySelfRatings;
  check(learner.signedIn && ratings?.assessedBy === 'self' && [ratings.support.outOf10, ratings.englishOutOf10].every(v => v >= 1 && v <= 10), 'Invalid account-first language onboarding');
  check(caseData.seeds.requests.some(r => r.id === ledger.lessonPlan.requestId), 'Missing intake request boundary');
  const runs = [...caseData.seeds.quizRuns, ...caseData.seeds.scoreExamples];
  unique(runs.map(r => r.id), 'quiz run');
  for (const run of runs) {
    try { rules.scoreQuiz(caseData, ledger, run); } catch (e) { errors.push(run.id + ': ' + e.message); }
    if (run.previousRunId) {
      const previous = runs.find(r => r.id === run.previousRunId);
      check(previous?.assessmentId === run.assessmentId && previous?.learnerId === run.learnerId && previous?.attemptNumber < run.attemptNumber, 'Invalid retry history');
    }
  }
  unique(caseData.seeds.conceptStates.map(s => s.conceptId), 'concept state');
  for (const state of caseData.seeds.conceptStates) {
    check(concepts.has(state.conceptId) && state.learnerId === learner.id, 'Invalid learner concept state');
    if (state.theoryCheck?.latestQuizRunId) {
      const run = caseData.seeds.quizRuns.find(r => r.id === state.theoryCheck.latestQuizRunId);
      const result = run ? rules.scoreQuiz(caseData, ledger, run) : null;
      check(result && result.percent === state.theoryCheck.attemptPercent && result.passed === (state.theoryCheck.status === 'passed'), 'Theory progress lacks matching quiz evidence');
    }
    check(state.dims.words?.evidence === 0 && state.dims.english?.evidence === 0 && state.dims.lab?.evidence === 0, 'These fixtures must not invent language or practical evidence from MCQs');
  }
  unique(caseData.seeds.labSessions.map(s => s.id), 'session id');
  for (const session of caseData.seeds.labSessions) {
    check(session.ownerLearnerId === learner.id && session.practicalId === practical?.id, 'Invalid session owner/practical');
    check(session.lastSyncedRevision <= session.revision, 'Invalid synced revision');
    check(!session.observerDeviceIds.includes(session.controllingDeviceId), 'Controlling device cannot also be observer');
    for (const e of session.evidence) check(cps.has(e.checkpointId) && !(e.source === 'student_report' && e.verdict === 'verified'), 'Invalid or self-certified checkpoint evidence');
    if (session.status === 'active') check(rules.pointerActivation(caseData, ledger, session, caseData.seeds.quizRuns).active, 'Active session fails activation gate');
  }
  for (const h of caseData.seeds.handoffs) {
    check(caseData.seeds.labSessions.some(s => s.id === h.labSessionId && s.ownerLearnerId === h.ownerLearnerId), 'Handoff references unknown session/owner');
    check(h.authenticationRequired && h.sameOwnerRequired && h.transfersControl && h.externalProjectPolicy === 'required_if_software_opened', 'Unsafe handoff policy');
  }
  return errors;
}

if (require.main === module) {
  const file = path.resolve(process.argv[2] || path.join(__dirname, 'cases/analog-modulation-odia.json'));
  const caseData = JSON.parse(fs.readFileSync(file));
  const ledgerFile = path.resolve(path.dirname(file), caseData.ledgerFile);
  const ledger = JSON.parse(fs.readFileSync(ledgerFile));
  const generic = spawnSync(process.execPath, [path.join(__dirname, 'validate.js'), ledgerFile], { encoding: 'utf8' });
  process.stdout.write(generic.stdout);
  if (generic.status !== 0) { process.stderr.write(generic.stderr); process.exit(1); }
  const errors = validateCase(caseData, ledger);
  if (errors.length) { errors.forEach(e => console.error('ERROR [CASE] ' + e)); process.exit(1); }
  console.log('\nLearning case valid: references, bilingual coverage, assessments, lab gates, checkpoints and synthetic sessions.');
  console.log('Draft review status retained. This does not certify native-language accuracy or live tool execution.');
}
module.exports = { validateCase };
