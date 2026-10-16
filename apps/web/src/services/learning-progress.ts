import type { ChapterView, ChapterProgress } from '../contracts/api';
import type { AssessmentOverview } from '../contracts/assessment';
import type { SavedPositions } from '../contracts/learning';
import { ProgressSchema } from '../contracts/learning';
import { ASSESSMENT_CONCEPTS, CHAPTER_ASSESSMENT } from '../contracts/assessment-catalog';
import { ServiceError } from './types';

/** Display projection of the SAME evaluated overview used by quizzes; no second score store. */
export function projectLearningProgress(chapter: ChapterView, overview: AssessmentOverview, positions: SavedPositions): ChapterProgress {
  if (overview.planId !== chapter.planId) throw new ServiceError('The progress belongs to another chapter.');
  const concepts = chapter.concepts.map(c => {
    const check = overview.concepts.find(row => row.conceptId === c.id);
    if (!check) throw new ServiceError('The chapter progress is incomplete.');
    return { conceptId: c.id, status: check.status === 'not_attempted' ? positions[c.id] ? 'learning' as const : 'not_started' as const : check.status,
      theoryCheck: { status: check.status, ...(check.latestRunId ? { latestRunId: check.latestRunId } : {}), ...(check.percent !== null ? { attemptPercent: check.percent } : {}) }, ...(positions[c.id] ? { position: positions[c.id] } : {}) };
  });
  const chapterResult = overview.attempts.filter(a => a.run.assessmentId === CHAPTER_ASSESSMENT && a.result).sort((a,b) => Date.parse(b.result!.completedAt)-Date.parse(a.result!.completedAt) || b.run.attemptNumber-a.run.attemptNumber)[0]?.result;
  const required: string[] = ASSESSMENT_CONCEPTS.filter(c => c.requiredForLab).map(c => c.id);
  const hasEvidence = concepts.some(c => c.theoryCheck.status !== 'not_attempted');
  return ProgressSchema.parse({ ownerLearnerId: overview.ownerLearnerId, planId: chapter.planId, concepts,
    chapterTest: chapterResult ? { status: chapterResult.passed ? 'passed' : 'revisit', latestRunId: chapterResult.runId, attemptPercent: chapterResult.percent } : { status: 'not_attempted' },
    rings: { concept: hasEvidence ? { done: concepts.filter(c => c.status === 'passed').length, total: concepts.length } : null, words: null, english: null, lab: null },
    labReadiness: { practicalId: 'PR-AM-DSB', ready: overview.labReady, requiredConceptIds: required, missingConceptIds: overview.labMissingConceptIds, evidenceRunIds: overview.concepts.filter(c => required.includes(c.conceptId) && c.status === 'passed').map(c => c.latestRunId!), chapterTestRequired: false },
  });
}
