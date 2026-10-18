import preview from './concept-media-C-AM-08.json';
import type { MediaApi } from '../contracts/services';
import { MediaManifestSchema, MediaExperienceSchema, type MediaManifest, type MediaExperience } from '../contracts/concept-media';
import { playableNarration } from '../services/media-http';
import { ServiceError } from '../services/types';

// Explicit development sample only. These imports and WAVs are excluded from connected builds.
const records = import.meta.glob<{ manifest: unknown }>('./all-cam/*.json', { import: 'default', eager: true });
const clips = import.meta.glob<string>('../../../../data-model/media/all-cam/assets/*.wav', { query: '?url', import: 'default', eager: true });
const manifests = new Map<string, MediaManifest>(Object.values(records).map(record => { const manifest = MediaManifestSchema.parse(record.manifest); return [manifest.conceptId, manifest]; }));
export const sampleMediaExperience = MediaExperienceSchema.parse(preview.experience);
export function sampleMediaExperienceForConcept(id: string): MediaExperience | undefined {
  const m = manifests.get(id); if (!m) return;
  if (id === 'C-AM-08') return sampleMediaExperience;
  return { schema: 'media-experience/v1', catalogVersion: m.catalogVersion, mediaRevision: m.mediaRevision, release: m.release,
    narration: m.narration.map(r => 'scope' in r ? { scope: r.scope, conceptId: r.conceptId, placardIds: r.placardIds, lang: r.lang } : { placardId: r.placardId, lang: r.lang }),
    artifacts: m.artifacts.map(a => ({ artifactId: a.artifactId, renderer: a.renderer, placardIds: a.placardIds })) };
}
export function createFixtureMedia(requireUid: () => string): MediaApi {
  return {
    getManifest: async (id, signal) => { requireUid(); signal?.throwIfAborted(); const m = manifests.get(id); if (!m) throw new ServiceError('No sample media for this lesson.', 404); return m; },
    loadNarration: async (id, revision, rendition, signal) => {
      requireUid(); const m = manifests.get(id);
      const url = clips[`../../../../data-model/media/all-cam/assets/${rendition.assetId}.wav`];
      if (!m || m.mediaRevision !== revision || !m.narration.some(r => r.renditionId === rendition.renditionId && r.assetId === rendition.assetId) || !url) throw new ServiceError('This narration file was not found.', 404);
      const response = await fetch(url, { signal });
      if (!response.ok) throw new ServiceError('The sample narration could not be loaded.', response.status);
      return playableNarration(await response.arrayBuffer(), rendition);
    },
  };
}
