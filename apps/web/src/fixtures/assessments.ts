import bank from './assessment-bank.json';
import { ASSESSMENT_CONCEPTS, CHAPTER_ASSESSMENT } from '../contracts/assessment-catalog';
import { checkResponses, sameResponses, RunSchema, ResultSchema, OverviewSchema, type AssessmentOverview } from '../contracts/assessment';
import type { AssessmentRun, QuizResult } from '../contracts/api';
import type { AssessmentApi } from '../contracts/services';
import { COURSE } from '../contracts/profile';
import { ServiceError } from '../services/types';

interface StoredAttempt { startKey: string; run: AssessmentRun; result: QuizResult | null }
export function createFixtureAssessments(requireUid: () => string): AssessmentApi {
  const storageKey = () => `kiki:assessments:fixture:v1:${requireUid()}`;
  function read(): StoredAttempt[] {
    const uid = requireUid(), raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed: StoredAttempt[] = JSON.parse(raw);
    return parsed.map(record => {
      const run = RunSchema.parse(record.run), result = record.result ? ResultSchema.parse(record.result) : null;
      if (run.ownerLearnerId !== uid || (result && (result.ownerLearnerId !== uid || result.runId !== run.runId))) throw new ServiceError('This attempt does not belong to your sample account.');
      return { startKey: record.startKey, run, result };
    });
  }
  const write = (records: StoredAttempt[]) => { localStorage.setItem(storageKey(), JSON.stringify(records)); };
  const find = (records: StoredAttempt[], id: string) => {
    const record = records.find(r => r.run.runId === id);
    if (!record) throw new ServiceError('This attempt could not be found.', 404);
    return record;
  };
  function overview(): AssessmentOverview {
    const attempts = read().filter(r => r.run.contentVersion === bank.version);
    const latest = (assessmentId: string) => attempts.filter(a => a.run.assessmentId === assessmentId && a.result).sort((a,b) => Date.parse(b.result!.completedAt)-Date.parse(a.result!.completedAt) || b.run.attemptNumber-a.run.attemptNumber)[0];
    const concepts = ASSESSMENT_CONCEPTS.map(c => {
      const completed = latest(c.assessmentId);
      return { conceptId: c.id, assessmentId: c.assessmentId, title: c.title, status: completed ? completed.result!.passed ? 'passed' as const : 'revisit' as const : 'not_attempted' as const, latestRunId: completed?.run.runId ?? null, percent: completed?.result?.percent ?? null };
    });
    const missing = concepts.filter(c => c.status !== 'passed').map(c => c.conceptId);
    const labMissing = missing.filter(id => ASSESSMENT_CONCEPTS.some(c => c.id === id && c.requiredForLab));
    return OverviewSchema.parse({ ownerLearnerId: requireUid(), planId: COURSE.chapterId, contentVersion: bank.version, concepts, chapterAllowed: !missing.length, chapterMissingConceptIds: missing, labReady: !labMissing.length, labMissingConceptIds: labMissing, chapterTestRequired: false, attempts: [...attempts].reverse().map(({run,result}) => ({run,result})) });
  }
  function newRun(assessmentId: string, records: StoredAttempt[], origin: AssessmentRun['origin'] = 'student_attempt'): AssessmentRun {
    const assignment = bank.sets.find(s => s.assessmentId === assessmentId);
    if (!assignment) throw new ServiceError('This check could not be found.', 404);
    return RunSchema.parse({ ownerLearnerId: requireUid(), runId: `run-${crypto.randomUUID()}`, assessmentId, scope: assignment.scope, attemptNumber: records.filter(r => r.run.assessmentId === assessmentId).length + 1, passPercent: assignment.passPercent,
      questions: assignment.questions.map(({questionId,conceptId,prompt,options}) => ({questionId,conceptId,prompt,options})), contentVersion: bank.version, revision: 0, status: 'in_progress', responses: [], currentQuestionIndex: 0, origin, createdAt: new Date().toISOString() });
  }
  function score(run: AssessmentRun, responses: AssessmentRun['responses']): QuizResult {
    checkResponses(run, responses, true);
    const assignment = bank.sets.find(s => s.assessmentId === run.assessmentId)!;
    const byConcept: QuizResult['byConcept'] = {};
    const feedback = run.questions.map(q => {
      const key = assignment.questions.find(k => k.questionId === q.questionId)!;
      const correct = responses.find(r => r.questionId === q.questionId)!.optionIndex === key.correctIndex;
      const group = byConcept[q.conceptId] ??= { correct: 0, total: 0, missedQuestionIds: [] };
      group.total++; if (correct) group.correct++; else group.missedQuestionIds.push(q.questionId);
      return { questionId: q.questionId, correct, explanation: key.explanation };
    });
    const correct = feedback.filter(f => f.correct).length, total = run.questions.length;
    const passed = correct * 100 >= run.passPercent * total;
    return ResultSchema.parse({ ownerLearnerId: requireUid(), contentVersion: run.contentVersion, runId: run.runId, assessmentId: run.assessmentId, correct, total, percent: correct/total*100, passPercent: run.passPercent, passed, byConcept, revisitConceptIds: Object.entries(byConcept).filter(([,g]) => g.correct < g.total).map(([id]) => id), nextAction: passed ? 'continue' : 'revisit_then_retry', feedback, completedAt: new Date().toISOString() });
  }
  return {
    start: async (assessmentId, signal, operationKey = crypto.randomUUID(), previousRunId) => {
      signal?.throwIfAborted(); const records = read();
      const same = records.find(r => r.startKey === operationKey);
      if (same) { if (same.run.assessmentId !== assessmentId) throw new ServiceError('This start key belongs to a different check.'); return same.run; }
      const inProgress = records.find(r => r.run.assessmentId === assessmentId && r.run.status === 'in_progress');
      if (inProgress) return inProgress.run;
      if (previousRunId && find(records, previousRunId).run.assessmentId !== assessmentId) throw new ServiceError('Retry must reference the same check.');
      if (assessmentId === CHAPTER_ASSESSMENT && !overview().chapterAllowed) throw new ServiceError('Pass all ten concept checks before starting the chapter test.', 409);
      const run = newRun(assessmentId, records); records.push({ startKey: operationKey, run, result: null }); write(records); return run;
    },
    get: async (runId, signal) => { signal?.throwIfAborted(); return find(read(), runId).run; },
    saveDraft: async (runId, draft, signal) => {
      signal?.throwIfAborted(); const records = read(), record = find(records, runId);
      if (record.run.status !== 'in_progress') throw new ServiceError('This attempt is already submitted.');
      if (record.run.revision !== draft.expectedRevision) {
        if (sameResponses(record.run.responses, draft.responses) && record.run.currentQuestionIndex === draft.currentQuestionIndex) return record.run;
        throw new ServiceError('The saved draft changed. Reopen this check before editing it.', 409);
      }
      checkResponses(record.run, draft.responses);
      record.run = RunSchema.parse({ ...record.run, responses: draft.responses, currentQuestionIndex: draft.currentQuestionIndex, revision: record.run.revision+1 }); write(records); return record.run;
    },
    submit: async (runId, submission, signal) => {
      signal?.throwIfAborted(); const records = read(), record = find(records, runId);
      if (record.result) {
        if (!sameResponses(record.run.responses, submission.responses)) throw new ServiceError('A submitted attempt cannot be changed.');
        return record.result;
      }
      record.result = score(record.run, submission.responses);
      record.run = RunSchema.parse({ ...record.run, responses: submission.responses, status: 'submitted', revision: record.run.revision+1 });
      write(records); return record.result;
    },
    getResult: async (runId, signal) => { signal?.throwIfAborted(); const result = find(read(), runId).result; if (!result) throw new ServiceError('This check has not been submitted.'); return result; },
    overview: async (planId, signal) => { signal?.throwIfAborted(); if (planId !== COURSE.chapterId) throw new ServiceError('Unknown chapter.'); return overview(); },
    previewChapterReady: async () => {
      const records = read();
      for (const concept of ASSESSMENT_CONCEPTS) {
        const run = newRun(concept.assessmentId, records, 'preview_setup');
        run.responses = bank.sets.find(s => s.assessmentId === concept.assessmentId)!.questions.map(q => ({ questionId: q.questionId, optionIndex: q.correctIndex }));
        run.status = 'submitted'; run.revision = 1;
        records.push({ startKey: `preview-setup-${crypto.randomUUID()}`, run, result: score(run, run.responses) });
      }
      write(records); return overview();
    },
  };
}
