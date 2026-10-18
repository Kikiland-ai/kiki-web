import { z } from 'zod';
import { CamCanvasSchema, type CamCanvas } from './cam-canvas';

/**
 * Prepared concept media (Python: kiki_api/media_models.py). A manifest is immutable and bound
 * to one catalog version: per-placard/language narration plus allowlisted teaching scenes.
 * Scenes name a trusted renderer; authored strings are never evaluated as code or formulas.
 */
const Sha = z.string().regex(/^[a-f0-9]{64}$/);
const CatalogVersion = z.string().regex(/^am-[a-f0-9]{24}$/);
const MediaRevision = z.string().regex(/^cm-[a-f0-9]{24}$/);
const Check = z.enum(['pending', 'accepted', 'rejected']);
const Release = z.enum(['sample_unreviewed', 'reviewed']);
const Source = z.object({ origin: z.string(), label: z.string(), url: z.string().url().optional() });

const PlacardFields = z.object({
  renditionId: z.string(), placardId: z.string().min(1), lang: z.enum(['en', 'or']),
  assetId: Sha, mimeType: z.literal('audio/wav'), bytes: z.number().int().gt(44).max(20_000_000), durationSeconds: z.number().positive().max(600),
  sourceTextSha256: Sha, speechScriptSha256: Sha, audioSha256: Sha,
  narrationKind: z.enum(['generated', 'recorded']),
  speech: z.object({ provider: z.string(), model: z.string(), voice: z.string(), style: z.string(), generator: z.string(), generatedAt: z.string() }),
  // Only the clip's own duration is known; sentence timing arrives with evaluated alignment.
  timing: z.object({ kind: z.literal('clip_duration_only'), alignment: z.literal('not_performed') }),
  review: z.object({ status: z.enum(['unreviewed', 'reviewed']), pronunciation: Check, nativeOdia: Check, spokenFidelity: Check, audioQuality: Check }),
});
export const PlacardNarrationRenditionSchema = PlacardFields.refine(r => r.assetId === r.audioSha256 && r.renditionId === `${r.placardId}.${r.lang}`, 'Rendition identity must follow its placard, language and audio.')
  .refine(r => (r.review.status === 'reviewed') === [r.review.pronunciation, r.review.nativeOdia, r.review.spokenFidelity, r.review.audioQuality].every(c => c === 'accepted'), 'Reviewed narration needs every check accepted.');
export const ConceptNarrationRenditionSchema = PlacardFields.omit({ placardId: true, renditionId: true }).extend({
  scope: z.literal('concept'), conceptId: z.string().regex(/^C-AM-(0[1-9]|10)$/), renditionId: z.string().regex(/^C-AM-(0[1-9]|10)\.concept\.(en|or)$/), placardIds: z.array(z.string()).min(1).max(4),
}).refine(r => r.assetId === r.audioSha256 && r.renditionId === `${r.conceptId}.concept.${r.lang}` && new Set(r.placardIds).size === r.placardIds.length, 'Concept audio identity/coverage differs.')
.refine(r => (r.review.status === 'reviewed') === [r.review.pronunciation, r.review.nativeOdia, r.review.spokenFidelity, r.review.audioQuality].every(c => c === 'accepted'), 'Reviewed narration needs every check accepted.');
export const NarrationRenditionSchema = z.union([PlacardNarrationRenditionSchema, ConceptNarrationRenditionSchema]);
export type NarrationRendition = z.infer<typeof NarrationRenditionSchema>;

const Control = z.object({ name: z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/), label: z.string().min(1), unit: z.literal('degree'), min: z.number(), max: z.number(), step: z.number().positive(), default: z.number() })
  .refine(c => c.min <= c.default && c.default <= c.max && Math.abs((c.max - c.min) / c.step - Math.round((c.max - c.min) / c.step)) < 1e-9, 'Control default and step must sit inside its bounds.');
export const PhaseRecoverySceneSchema = z.object({
  artifactId: z.string().regex(/^[A-Za-z0-9-]{1,96}$/), renderer: z.literal('coherent-phase-recovery/v1'),
  placardIds: z.array(z.string()).min(1).max(4), prompt: z.string().min(1),
  controls: z.array(Control).length(1), outputs: z.array(z.object({ name: z.string(), label: z.string(), unit: z.literal('dimensionless') })).length(1),
  comparisonDegrees: z.array(z.number()).min(1).max(6),
  residual: z.literal('not_modelled'), claim: z.literal('ideal_teaching_model'),
  sources: z.array(Source), bindings: z.array(z.object({ path: z.string().min(1), sha256: Sha })).min(1),
  behaviorTests: z.array(z.object({ inputs: z.record(z.string(), z.number()), output: z.string(), expected: z.number(), tolerance: z.number().positive().max(0.01) })).min(1),
  review: z.object({ scientific: Check }),
}).refine(s => new Set(s.placardIds).size === s.placardIds.length && s.comparisonDegrees.every(d => d >= s.controls[0].min && d <= s.controls[0].max), 'Scene slots or comparisons are invalid.');
export type PhaseRecoveryScene = z.infer<typeof PhaseRecoverySceneSchema>;

/** Renderers this app version can draw. Anything else is kept as unsupported, never executed. */
const SCENES = { 'coherent-phase-recovery/v1': PhaseRecoverySceneSchema, 'cam-concept-canvas/v1': CamCanvasSchema } as const;
export type SceneArtifact = PhaseRecoveryScene | CamCanvas;
export type UnsupportedArtifact = { artifactId: string; renderer: string; placardIds: string[] };
const ArtifactRef = z.object({ artifactId: z.string(), renderer: z.string(), placardIds: z.array(z.string()) });

export const MediaManifestSchema = z.object({
  schema: z.literal('concept-media-manifest/v1'), planId: z.literal('LP-ANALOG-MODULATION'), conceptId: z.string().regex(/^C-AM-(0[1-9]|10)$/),
  catalogVersion: CatalogVersion, mediaRevision: MediaRevision, release: Release,
  narration: z.array(NarrationRenditionSchema), artifacts: z.array(ArtifactRef.passthrough()),
}).transform((manifest, ctx) => {
  const scenes: SceneArtifact[] = [], unsupported: UnsupportedArtifact[] = [];
  for (const artifact of manifest.artifacts) {
    const schema = SCENES[artifact.renderer as keyof typeof SCENES];
    if (!schema) { unsupported.push({ artifactId: artifact.artifactId, renderer: artifact.renderer, placardIds: artifact.placardIds }); continue; }
    const scene = schema.safeParse(artifact);
    if (scene.success) scenes.push(scene.data);
    else ctx.addIssue({ code: 'custom', message: `Scene ${artifact.artifactId} does not match its renderer.` });
  }
  const ids = manifest.narration.map(r => r.renditionId);
  if (new Set(ids).size !== ids.length || new Set(manifest.artifacts.map(a => a.artifactId)).size !== manifest.artifacts.length) ctx.addIssue({ code: 'custom', message: 'Duplicate rendition or artifact.' });
  if (manifest.release === 'reviewed' && (manifest.narration.some(r => r.review.status !== 'reviewed') || scenes.some(s => s.review.scientific !== 'accepted'))) ctx.addIssue({ code: 'custom', message: 'A reviewed release cannot carry unreviewed media.' });
  return { ...manifest, artifacts: scenes, unsupportedArtifacts: unsupported };
});
export type MediaManifest = z.output<typeof MediaManifestSchema>;
export const MediaManifestEnvelope = z.object({ manifest: MediaManifestSchema });

/** Lesson-side pointer to the published manifest; the lesson text stays complete without it. */
export const MediaExperienceSchema = z.object({
  schema: z.literal('media-experience/v1'), catalogVersion: CatalogVersion, mediaRevision: MediaRevision, release: Release,
  audioAvailable: z.boolean().optional(),
  narration: z.array(z.union([z.object({ placardId: z.string(), lang: z.enum(['en', 'or']) }), z.object({ scope: z.literal('concept'), conceptId: z.string(), placardIds: z.array(z.string()), lang: z.enum(['en', 'or']) })])),
  artifacts: z.array(ArtifactRef),
});
export type MediaExperience = z.infer<typeof MediaExperienceSchema>;

/** The manifest must be the exact revision the lesson pointed to, for this lesson's placards. */
export function checkManifestForLesson(manifest: MediaManifest, lesson: { conceptId: string; placards: { id: string }[]; mediaExperience?: MediaExperience }) {
  const pointer = lesson.mediaExperience, cards = new Set(lesson.placards.map(p => p.id));
  if (!pointer || manifest.conceptId !== lesson.conceptId || manifest.mediaRevision !== pointer.mediaRevision || manifest.catalogVersion !== pointer.catalogVersion) throw new Error('The lesson media belongs to another lesson or revision.');
  const covered = (r: NarrationRendition) => 'scope' in r ? r.placardIds : [r.placardId];
  if (manifest.narration.some(r => covered(r).some(p => !cards.has(p)) || ('scope' in r && (r.conceptId !== lesson.conceptId || JSON.stringify(r.placardIds) !== JSON.stringify([...cards])))) || [...manifest.artifacts, ...manifest.unsupportedArtifacts].some(a => a.placardIds.some(id => !cards.has(id)))) throw new Error('The lesson media refers to placards outside this lesson or in the wrong order.');
  const refs = manifest.narration.map(r => 'scope' in r ? { scope: r.scope, conceptId: r.conceptId, placardIds: r.placardIds, lang: r.lang } : { placardId: r.placardId, lang: r.lang });
  if (JSON.stringify(refs) !== JSON.stringify(pointer.narration) || manifest.release !== pointer.release || JSON.stringify([...manifest.artifacts, ...manifest.unsupportedArtifacts].map(a => ({ artifactId: a.artifactId, renderer: a.renderer, placardIds: a.placardIds }))) !== JSON.stringify(pointer.artifacts)) throw new Error('The lesson media pointer differs from the manifest.');
  if (manifest.artifacts.some(a => a.renderer === 'cam-concept-canvas/v1' && a.scene.conceptId !== lesson.conceptId)) throw new Error('Canvas belongs to another lesson.');

  return manifest;
}

export function findRendition(manifest: MediaManifest | null, placardId: string, lang: 'en' | 'or') {
  return manifest?.narration.find(r => !('scope' in r) && r.placardId === placardId && r.lang === lang) ?? manifest?.narration.find(r => 'scope' in r && r.placardIds.includes(placardId) && r.lang === lang) ?? null;
}

/** Always shown beside the player, so nobody mistakes unreviewed speech for reviewed narration. */
export function narrationLabel(rendition: Pick<NarrationRendition, 'narrationKind' | 'review'>, release: MediaManifest['release']): string {
  const reviewed = release === 'reviewed' && rendition.review.status === 'reviewed';
  if (!reviewed) return rendition.narrationKind === 'generated' ? 'Sample audio · machine voice, not reviewed' : 'Sample audio · not reviewed';
  return rendition.narrationKind === 'generated' ? 'Machine voice' : 'Recorded voice';
}

/** API binding is authoritative; secure-context consumers independently verify exact display text. */
export async function verifyNarrationTextBindings(manifest: MediaManifest, lesson: { placards: { id: string; body: { en: string; or: string } }[] }) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return;
  for (const rendition of manifest.narration) {
    const ids = 'scope' in rendition ? rendition.placardIds : [rendition.placardId];
    const text = ids.map(id => lesson.placards.find(p => p.id === id)?.body[rendition.lang]);
    if (text.some(t => t === undefined)) throw new Error('Narration refers to an unknown text.');
    const hash = [...new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(text.join(' '))))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== rendition.sourceTextSha256) throw new Error('Narration does not match the current lesson text.');
  }
}
