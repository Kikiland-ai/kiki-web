import content from './learning-content.json';
import visual from './dsb-sc-visual.json';
import type { AssessmentApi, LearningApi } from '../contracts/services';
import { ChapterSchema, LessonSchema, SavedPositionsSchema, type SavedPositions } from '../contracts/learning';
import { projectLearningProgress } from '../services/learning-progress';
import { ServiceError } from '../services/types';

/** Development-only draft content; no seeded learner, score store or answer keys. */
export function createFixtureLearning(requireUid: () => string, assessments: AssessmentApi): LearningApi {
  const chapter = ChapterSchema.parse(content.chapter);
  const key = (uid: string) => `kiki:learning-positions:fixture:v1:${uid}`;
  const owner = (uid: string, signal?: AbortSignal) => { signal?.throwIfAborted(); if (requireUid() !== uid) throw new ServiceError('Your account changed. Reopen the lesson.'); };
  function read(uid: string): SavedPositions {
    const raw = localStorage.getItem(key(uid));
    if (!raw) return {};
    try {
      const saved = SavedPositionsSchema.parse(JSON.parse(raw));
      if (saved.ownerLearnerId !== uid) throw new Error('Owner mismatch');
      return saved.positions;
    } catch { throw new ServiceError('Your saved lesson position could not be read. Your previous data was kept.'); }
  }
  function lesson(id: string) {
    const value = (content.lessons as Record<string, unknown>)[id];
    if (!value) throw new ServiceError('This concept was not found.', 404);
    return LessonSchema.parse(id === 'C-AM-04' ? {...value as object, visual} : value);
  }
  async function progress(uid: string, signal?: AbortSignal) {
    const overview = await assessments.overview(chapter.planId, signal);
    owner(uid, signal);
    if (overview.ownerLearnerId !== uid) throw new ServiceError('The progress belongs to another account.');
    return projectLearningProgress(chapter, overview, read(uid));
  }
  return {
    getChapter: async (id, signal) => { const uid = requireUid(); owner(uid,signal); if (id !== chapter.planId) throw new ServiceError('This chapter was not found.',404); return structuredClone(chapter); },
    getConceptLesson: async (id, signal) => { const uid = requireUid(); owner(uid,signal); return lesson(id); },
    getProgress: async (id, signal) => { const uid = requireUid(); if (id !== chapter.planId) throw new ServiceError('This chapter was not found.',404); return progress(uid, signal); },
    savePosition: async (id, placardId, signal) => {
      const uid = requireUid(), target = lesson(id);
      if (!target.placards.some(p => p.id === placardId)) throw new ServiceError('This placard does not belong to the concept.');
      const current = await progress(uid, signal); owner(uid, signal);
      const positions = read(uid); positions[id] = { placardId, updatedAt: new Date().toISOString() };
      try { localStorage.setItem(key(uid), JSON.stringify({ schema:'learning-positions/v1', ownerLearnerId: uid, positions })); }
      catch { throw new ServiceError('Your place was not saved. Retry when browser storage is available.'); }
      const row = current.concepts.find(c => c.conceptId === id)!;
      return { ...row, status: row.status === 'not_started' ? 'learning' : row.status, position: positions[id] };
    },
  };
}
