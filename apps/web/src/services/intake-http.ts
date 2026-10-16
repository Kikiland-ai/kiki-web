import type { z } from 'zod';
import { RequestEnvelope, RequestsEnvelope, SourceEnvelope, type IntakeApi, validateMaterial } from '../contracts/intake';
import type { AuthService } from '../contracts/services';
import { ServiceError } from './types';

export function createIntakeApi(baseUrl: string, auth: AuthService, fetcher: typeof fetch = fetch): IntakeApi {
  const base = baseUrl.replace(/\/$/, '');
  const pathId = (id: string) => encodeURIComponent(id);
  async function call(path: string, method: string, body?: BodyInit, key?: string, signal?: AbortSignal) {
    const headers: Record<string, string> = { Authorization: `Bearer ${await auth.getIdToken()}` };
    if (typeof body === 'string') headers['Content-Type'] = 'application/json';
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetcher(base + path, { method, body, headers, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) });
    if (!response.ok) {
      // Display only validated server boundary messages, never arbitrary upstream bodies.
      const error = await response.json().catch(() => null);
      const detail = typeof error?.detail === 'string' && error.detail.length <= 240 ? error.detail : '';
      throw new ServiceError(detail || (response.status === 403 ? 'You do not have access to this material.' : response.status === 404 ? 'This material could not be found.' : response.status === 401 ? 'Sign in again to open your material.' : 'The material service could not complete this action. Retry without changing the files.'), response.status);
    }
    return response;
  }
  async function json<T>(path: string, schema: z.ZodType<T>, method = 'GET', body?: string | FormData, key?: string, signal?: AbortSignal): Promise<T> {
    const result = schema.safeParse(await (await call(path, method, body, key, signal)).json());
    if (!result.success) throw new ServiceError('The material service returned an unsupported response.');
    return result.data;
  }
  return {
    list: async signal => (await json('/study-requests', RequestsEnvelope, 'GET', undefined, undefined, signal)).requests,
    listPage: async (cursor, signal) => {
      const page = await json(`/study-requests${cursor ? `?cursor=${pathId(cursor)}` : ''}`, RequestsEnvelope, 'GET', undefined, undefined, signal);
      return { requests: page.requests, nextCursor: page.nextCursor ?? null };
    },
    get: async (id, signal) => (await json(`/study-requests/${pathId(id)}`, RequestEnvelope, 'GET', undefined, undefined, signal)).request,
    create: async (input, key, signal) => {
      if (input.files.length < 1 || input.files.length > 5) throw new ServiceError('Choose one to five files.');
      for (const file of input.files) { const error = await validateMaterial(file); if (error) throw new ServiceError(error); }
      const form = new FormData();
      const { files, ...context } = input;
      form.append('context', JSON.stringify(context));
      files.forEach(file => form.append('files', file));
      return (await json('/study-requests', RequestEnvelope, 'POST', form, key, signal)).request;
    },
    confirm: async (id, outline, key, signal) => (await json(`/study-requests/${pathId(id)}/confirm`, RequestEnvelope, 'POST', JSON.stringify({ outline }), key, signal)).request,
    retry: async (id, key, signal) => (await json(`/study-requests/${pathId(id)}/retry`, RequestEnvelope, 'POST', '{}', key, signal)).request,
    source: async (id, signal) => {
      const { source } = await json(`/source-docs/${pathId(id)}`, SourceEnvelope, 'GET', undefined, undefined, signal);
      const blob = await (await call(`/source-docs/${pathId(id)}/content`, 'GET', undefined, undefined, signal)).blob();
      if (blob.type !== source.mime || blob.size !== source.size) throw new ServiceError('The original file does not match its saved record.');
      return { source, blob };
    },
  };
}
