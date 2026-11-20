import type { z } from 'zod';
import type { LabNarrationApi } from '../contracts/lab-narration';
import type { AuthService } from '../contracts/services';
import { playableNarration } from './media-http';
import { ServiceError } from './types';

export function createLabNarrationApi<Manifest>(
  root: (scopeId: string) => string,
  schema: z.ZodType<Manifest>,
  auth: AuthService,
  fetcher: typeof fetch,
): LabNarrationApi<Manifest> {
  const id = encodeURIComponent;
  async function request(scopeId: string, suffix: string, signal: AbortSignal) {
    const token = await auth.getIdToken();
    signal.throwIfAborted();
    const response = await fetcher(root(id(scopeId)) + suffix, {
      headers: { Authorization: `Bearer ${token}` }, credentials: 'omit', redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) throw new ServiceError('Lab narration is unavailable.', response.status);
    return response;
  }
  return {
    manifest: async (scopeId, signal) => schema.parse(await (await request(scopeId, '', signal)).json()),
    clip: async (scopeId, revision, clip, signal) => {
      const response = await request(scopeId, `/${id(revision)}/assets/${id(clip.assetId)}`, signal);
      if (response.headers.get('Content-Type')?.split(';')[0] !== 'audio/wav') throw new ServiceError('Lab narration is invalid.');
      return playableNarration(await response.arrayBuffer(), { bytes: clip.bytes, audioSha256: clip.assetId, mimeType: 'audio/wav' });
    },
  };
}
