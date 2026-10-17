import preview from './concept-media-C-AM-08.json';
import type { MediaApi } from '../contracts/services';
import { MediaManifestSchema } from '../contracts/concept-media';
import { playableNarration } from '../services/media-http';
import { ServiceError } from '../services/types';

// Development sample only: the same committed package Python publishes (data-model/media), with
// the manifest exported by apps/api/scripts/export_concept_media_preview.py. Connected builds never
// import this module, so these clips are not part of a production bundle.
const clips = import.meta.glob<string>('../../../../data-model/media/C-AM-08/*.wav', { query: '?url', import: 'default', eager: true });
const files: Record<string, string> = preview.files;

export const sampleMediaExperience = preview.experience;

export function createFixtureMedia(requireUid: () => string): MediaApi {
  const manifest = () => MediaManifestSchema.parse(preview.manifest);
  return {
    getManifest: async (conceptId, signal) => {
      requireUid(); signal?.throwIfAborted();
      if (conceptId !== preview.manifest.conceptId) throw new ServiceError('This lesson has no published audio yet.', 404);
      return manifest();
    },
    loadNarration: async (conceptId, mediaRevision, rendition, signal) => {
      requireUid();
      const url = clips[`../../../../data-model/media/C-AM-08/${files[rendition.assetId]}`];
      if (conceptId !== preview.manifest.conceptId || mediaRevision !== preview.manifest.mediaRevision || !url) throw new ServiceError('This narration file was not found.', 404);
      const response = await fetch(url, { signal });
      if (!response.ok) throw new ServiceError('The sample narration could not be loaded.', response.status);
      return playableNarration(await response.arrayBuffer(), rendition);
    },
  };
}
