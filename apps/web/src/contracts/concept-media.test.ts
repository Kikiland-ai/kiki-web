import { describe, expect, it } from 'vitest';
import preview from '../fixtures/concept-media-C-AM-08.json';
import content from '../fixtures/learning-content.json';
import { LessonSchema } from './learning';
import { checkManifestForLesson, findRendition, MediaManifestSchema, narrationLabel } from './concept-media';

const lesson = LessonSchema.parse({ ...content.lessons['C-AM-08'], mediaExperience: preview.experience });
const raw = () => structuredClone(preview.manifest) as Record<string, unknown> & typeof preview.manifest;

describe('concept media contract', () => {
  it('accepts the published C-AM-08 package: eight placard/language clips and its own phase scene', () => {
    const manifest = checkManifestForLesson(MediaManifestSchema.parse(raw()), lesson);
    expect(manifest.narration).toHaveLength(8);
    for (const placard of lesson.placards) for (const lang of ['en', 'or'] as const) expect(findRendition(manifest, placard.id, lang)?.timing.kind).toBe('clip_duration_only');
    expect(manifest.artifacts.map(a => a.renderer)).toEqual(['coherent-phase-recovery/v1']);
    expect(manifest.artifacts[0].placardIds).toEqual(['CARD-AM-08-concept', 'CARD-AM-08-application']);
    expect(manifest.unsupportedArtifacts).toEqual([]);
    expect(findRendition(manifest, 'CARD-AM-08-unknown', 'en')).toBeNull();
  });

  it('keeps every clip labelled unreviewed until a reviewed release says otherwise', () => {
    const manifest = MediaManifestSchema.parse(raw());
    expect(manifest.release).toBe('sample_unreviewed');
    for (const clip of manifest.narration) {
      expect(clip.review.status).toBe('unreviewed');
      expect(narrationLabel(clip, manifest.release)).toBe('Sample audio · machine voice, not reviewed');
    }
    const reviewed = raw(); reviewed.release = 'reviewed';
    expect(MediaManifestSchema.safeParse(reviewed).success).toBe(false);
    const clip = manifest.narration[0];
    expect(narrationLabel({ ...clip, review: { ...clip.review, status: 'reviewed' } }, 'reviewed')).toBe('Machine voice');
  });

  it('rejects invented sentence timing and clips that are not content-addressed', () => {
    const timed = raw(); (timed.narration[0].timing as Record<string, unknown>) = { kind: 'sentence_aligned', alignment: 'performed' };
    expect(MediaManifestSchema.safeParse(timed).success).toBe(false);
    const moved = raw(); moved.narration[0].assetId = 'f'.repeat(64);
    expect(MediaManifestSchema.safeParse(moved).success).toBe(false);
  });

  it('keeps an unknown renderer as unsupported, never as something to run, and rejects a corrupt known one', () => {
    const future = raw(); future.artifacts.push({ artifactId: 'SCENE-NEXT', renderer: 'future-scene/v9', placardIds: ['CARD-AM-08-recap'] } as never);
    const manifest = MediaManifestSchema.parse(future);
    expect(manifest.artifacts).toHaveLength(1);
    expect(manifest.unsupportedArtifacts).toEqual([{ artifactId: 'SCENE-NEXT', renderer: 'future-scene/v9', placardIds: ['CARD-AM-08-recap'] }]);
    const corrupt = raw(); (corrupt.artifacts[0].controls[0] as Record<string, unknown>).default = 400;
    expect(MediaManifestSchema.safeParse(corrupt).success).toBe(false);
  });

  it('only pairs a manifest with the lesson revision and placards that point to it', () => {
    const manifest = MediaManifestSchema.parse(raw());
    expect(() => checkManifestForLesson(manifest, { ...lesson, mediaExperience: { ...lesson.mediaExperience!, mediaRevision: 'cm-' + '0'.repeat(24) } })).toThrow('another lesson or revision');
    expect(() => checkManifestForLesson(manifest, { ...lesson, mediaExperience: undefined })).toThrow();
    expect(() => checkManifestForLesson(manifest, { ...lesson, placards: lesson.placards.slice(0, 2) })).toThrow('outside this lesson');
    expect(LessonSchema.safeParse({ ...content.lessons['C-AM-01'], mediaExperience: preview.experience }).success).toBe(false);
  });
});
