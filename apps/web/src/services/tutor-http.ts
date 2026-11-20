import type { z } from 'zod';
import type { AuthService } from '../contracts/services';
import { QuestionView, Report, SpeechResult, TurnView, TutorHealth, VoiceToken, type TutorApi } from '../contracts/tutor';
import { ServiceError } from './types';

export function createTutorApi(baseUrl: string, auth: AuthService, fetcher: typeof fetch = fetch): TutorApi {
  async function request<T>(path: string, schema: z.ZodType<T>, method = 'GET', body?: unknown, signal?: AbortSignal, key?: string, timeoutMs = 20000): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${await auth.getIdToken()}`, 'Content-Type': 'application/json' };
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetcher(baseUrl.replace(/\/$/, '') + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      let detail = '';
      try { detail = ((await response.json()) as { detail?: string }).detail ?? ''; } catch { /* keep the generic message */ }
      const message = response.status === 401 ? 'Your sign-in has expired. Sign out and sign in again.'
        : response.status === 404 ? 'That tutor session could not be found.'
        : response.status === 409 ? detail || 'This session changed. Reload to continue.'
        : response.status === 503 ? detail || 'Tutor mode is not available right now.'
        : 'KiKi could not answer just now. Please retry.';
      throw new ServiceError(message, response.status);
    }
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new ServiceError('KiKi received an unsupported tutor response.');
    return parsed.data;
  }
  const id = encodeURIComponent;
  return {
    health: () => request('/tutor/health', TutorHealth),
    question: (questionId, signal) => request(`/tutor/questions/${id(questionId)}`, QuestionView, 'GET', undefined, signal),
    start: (questionId, lang, key, signal) => request('/tutor/sessions', TurnView, 'POST', { questionId, lang }, signal, key),
    get: (sessionId, signal) => request(`/tutor/sessions/${id(sessionId)}`, TurnView, 'GET', undefined, signal),
    turn: (sessionId, input, key, signal) => request(`/tutor/sessions/${id(sessionId)}/turns`, TurnView, 'POST', input, signal, key),
    report: (sessionId, signal) => request(`/tutor/sessions/${id(sessionId)}/report`, Report, 'GET', undefined, signal, undefined, 30000),
    speech: (sessionId, text) => request(`/tutor/sessions/${id(sessionId)}/speech`, SpeechResult, 'POST', { text }),
    voiceToken: (sessionId) => request(`/tutor/sessions/${id(sessionId)}/voice-token`, VoiceToken, 'POST'),
  };
}
