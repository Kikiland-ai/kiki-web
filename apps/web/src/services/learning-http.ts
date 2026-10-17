import type { z } from 'zod';
import type { LearningApi, AuthService } from '../contracts/services';
import { ChapterEnvelope, LessonEnvelope, ProgressEnvelope, PositionEnvelope } from '../contracts/learning';
import { ServiceError } from './types';

export function createLearningApi(baseUrl: string, auth: AuthService, fetcher: typeof fetch = fetch): LearningApi {
  const base = baseUrl.replace(/\/$/, '');
  const id = encodeURIComponent;
  async function call<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal, body?: object): Promise<T> {
    const response = await fetcher(base+path, { method: body ? 'PUT' : 'GET', headers: { Authorization: `Bearer ${await auth.getIdToken()}`, ...(body ? { 'Content-Type':'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    if (!response.ok) throw new ServiceError(response.status === 401 ? 'Sign in again to open your learning material.' : response.status === 403 ? 'Add Analog Communication from Home → Add your subject, then reopen Learn.' : response.status === 404 ? 'This learning material is not available from the connected service yet.' : 'The learning service is unavailable. Please retry.', response.status);
    const result = schema.safeParse(await response.json());
    if (!result.success) throw new ServiceError('The learning service returned an unsupported response.');
    return result.data;
  }
  return {
    getChapter: async (planId, signal) => { const { chapter } = await call(`/lesson-plans/${id(planId)}`,ChapterEnvelope,signal); if (chapter.planId !== planId) throw new ServiceError('The response belongs to another chapter.'); return chapter; },
    getConceptLesson: async (conceptId, signal) => { const { lesson } = await call(`/concepts/${id(conceptId)}/lesson`,LessonEnvelope,signal); if (lesson.conceptId !== conceptId) throw new ServiceError('The response belongs to another concept.'); return lesson; },
    getProgress: async (planId, signal) => { const { progress } = await call(`/learners/me/progress?planId=${id(planId)}`,ProgressEnvelope,signal); if (progress.planId !== planId) throw new ServiceError('The progress belongs to another chapter.'); return progress; },
    savePosition: async (conceptId, placardId, signal) => { const { position } = await call(`/learners/me/positions/${id(conceptId)}`,PositionEnvelope,signal,{placardId}); if (position.conceptId !== conceptId || position.position?.placardId !== placardId) throw new ServiceError('The saved place does not match this lesson.'); return position; },
  };
}
