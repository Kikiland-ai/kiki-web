import type { z } from 'zod';
import type { AuthService, AssessmentApi } from '../contracts/services';
import { RunEnvelope, ResultEnvelope, OverviewEnvelope } from '../contracts/assessment';
import { ServiceError } from './types';

export function createAssessmentApi(baseUrl: string, auth: AuthService, fetcher: typeof fetch = fetch): AssessmentApi {
  async function request<T>(path: string, schema: z.ZodType<T>, method = 'GET', body?: unknown, signal?: AbortSignal, key?: string): Promise<T> {
    const headers: Record<string,string> = { Authorization: `Bearer ${await auth.getIdToken()}`, 'Content-Type': 'application/json' };
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetcher(baseUrl.replace(/\/$/,'') + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    if (!response.ok) throw new ServiceError(response.status === 409 ? 'The saved check changed or its prerequisites are incomplete. Reopen it before retrying.' : response.status === 403 ? 'You do not have access to this attempt.' : 'Your check could not be saved or loaded. Please retry.', response.status);
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new ServiceError('The assessment service returned an unsupported assignment or result.');
    return parsed.data;
  }
  const id = encodeURIComponent;
  return {
    start: async (assessmentId, signal, key = crypto.randomUUID(), previousRunId) => (await request('/assessment-runs', RunEnvelope, 'POST', { assessmentId, ...(previousRunId ? { previousRunId } : {}) }, signal, key)).run,
    get: async (runId, signal) => (await request(`/assessment-runs/${id(runId)}`, RunEnvelope, 'GET', undefined, signal)).run,
    saveDraft: async (runId, draft, signal, key = crypto.randomUUID()) => (await request(`/assessment-runs/${id(runId)}/draft`, RunEnvelope, 'PUT', draft, signal, key)).run,
    submit: async (runId, submission, signal, key = crypto.randomUUID()) => (await request(`/assessment-runs/${id(runId)}/submit`, ResultEnvelope, 'POST', submission, signal, key)).result,
    getResult: async (runId, signal) => (await request(`/assessment-runs/${id(runId)}/result`, ResultEnvelope, 'GET', undefined, signal)).result,
    overview: async (planId, signal) => (await request(`/learners/me/assessment-overview?planId=${id(planId)}`, OverviewEnvelope, 'GET', undefined, signal)).overview,
  };
}
