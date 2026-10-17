import type { z } from 'zod';
import type { AuthService, LearnerApi } from './types';
import { ServiceError } from './types';
import { ProfileEnvelopeSchema } from '../contracts/profile';

export function createLearnerApi(baseUrl: string, auth: AuthService, fetcher: typeof fetch = fetch): LearnerApi {
  async function request<T>(path: string, schema: z.ZodType<T>, options: { method: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
    // UID is derived from the verified bearer token by Python, never supplied as authority.
    const token = await auth.getIdToken();
    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method: options.method, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      throw new ServiceError(response.status === 401 ? 'Your sign-in has expired. Sign out and sign in again.' : response.status === 403 ? 'You do not have access to this record.' : 'Your changes were not saved. Please retry.', response.status);
    }
    const result = schema.safeParse(await response.json());
    if (!result.success) throw new ServiceError('Kiki received an unsupported response. Your changes have not been confirmed.');
    // A bad/mismatched API response must never render another learner's profile.
    return result.data;
  }
  return {
    bootstrap: async (signal) => (await request('/learners/me/bootstrap', ProfileEnvelopeSchema, { method: 'POST', signal })).profile,
    getProfile: async (signal) => (await request('/learners/me/profile', ProfileEnvelopeSchema, { method: 'GET', signal })).profile,
    updateProfile: async (body, signal) => (await request('/learners/me/profile', ProfileEnvelopeSchema, { method: 'PATCH', body, signal })).profile,
    enroll: async (courseId, semester, signal) => (await request('/learners/me/enrollments', ProfileEnvelopeSchema, { method: 'POST', body: { courseId, semester }, signal })).profile,
  };
}
