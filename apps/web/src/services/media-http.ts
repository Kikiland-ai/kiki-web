import type { AuthService, LoadedMedia, MediaApi } from '../contracts/services';
import { MediaManifestEnvelope, type NarrationRendition } from '../contracts/concept-media';
import { ServiceError } from './types';

/**
 * Checks bytes against the rendition before they can play. The SHA-256 check needs a secure
 * context (HTTPS or localhost); over a plain-HTTP LAN address only the size is checkable, and
 * the API has already verified the hash before sending.
 */
export async function playableNarration(bytes: ArrayBuffer, rendition: NarrationRendition): Promise<LoadedMedia> {
  if (bytes.byteLength !== rendition.bytes) throw new ServiceError('The narration file is incomplete. Please retry.');
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const hash = [...new Uint8Array(await subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== rendition.audioSha256) throw new ServiceError('The narration file could not be verified. Please retry.');
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: rendition.mimeType }));
  let released = false;
  return { url, release: () => { if (!released) { released = true; URL.revokeObjectURL(url); } } };
}

export function createMediaApi(baseUrl: string, auth: AuthService, fetcher: typeof fetch = fetch): MediaApi {
  const base = baseUrl.replace(/\/$/, '');
  const id = encodeURIComponent;
  async function get(path: string, signal: AbortSignal | undefined, seconds: number) {
    const response = await fetcher(base + path, { headers: { Authorization: `Bearer ${await auth.getIdToken()}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(seconds * 1000)]) : AbortSignal.timeout(seconds * 1000) });
    if (!response.ok) throw new ServiceError(response.status === 401 ? 'Sign in again to listen.' : response.status === 403 ? 'Add Analog Communication from Home → Add your subject, then reopen Learn.' : response.status === 404 ? 'This lesson has no published audio yet.' : 'Lesson audio is unavailable. The text is complete; please retry later.', response.status);
    return response;
  }
  return {
    getManifest: async (conceptId, signal) => {
      const result = MediaManifestEnvelope.safeParse(await (await get(`/concepts/${id(conceptId)}/media`, signal, 15)).json());
      if (!result.success) throw new ServiceError('The lesson media is not supported by this version of Kiki.');
      if (result.data.manifest.conceptId !== conceptId) throw new ServiceError('The lesson media belongs to another concept.');
      return result.data.manifest;
    },
    loadNarration: async (conceptId, mediaRevision, rendition, signal) => {
      const response = await get(`/concepts/${id(conceptId)}/media/${id(mediaRevision)}/assets/${id(rendition.assetId)}`, signal, 45);
      if (response.headers.get('Content-Type')?.split(';')[0] !== rendition.mimeType) throw new ServiceError('The narration file has an unexpected type.');
      return playableNarration(await response.arrayBuffer(), rendition);
    },
  };
}
