import { z } from 'zod';
import policies from '../../../../data-model/media/cam-contract/policies.json';
import conformance from '../../../../data-model/media/cam-contract/conformance.json';
import savedScenes from '../../../../data-model/media/cam-contract/scenes.json';

export const canonical = (v: unknown): string => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const binding = z.strictObject({ path: z.string().min(1), sha256: hash });
const source = z.strictObject({ origin: z.string(), label: z.string().min(1), url: z.string().url().nullable().optional() });
const check = z.enum(['pending', 'accepted', 'rejected']);
export const CamSceneSchema = z.strictObject({
  schema: z.literal('cam-interactive-scene/v1'), modelVersion: z.literal('cam-packets/3'), conceptId: z.string().regex(/^C-AM-(0[1-9]|10)$/),
  kind: z.enum(['signal', 'flow', 'am', 'dsb', 'spectrum', 'receiver', 'filter', 'phase_recovery', 'fm', 'pm']), title: z.string(),
  controls: z.array(z.strictObject({ name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), label: z.string().min(1), unit: z.enum(['', 'normalized', 'Hz', 'degree']), min: z.number().finite(), max: z.number().finite(), step: z.number().positive(), default: z.number().finite() })).min(1).max(3),
  visualBrief: z.strictObject({ kind: z.enum(['waveform', 'block', 'graph', 'table']), description: z.string(), alt: z.string(), from: source }),
  walkthrough: z.array(z.record(z.string(), z.string())), sourceInteractive: z.record(z.string(), z.json()), assumptions: z.array(z.string()),
  review: z.strictObject({ scientific: check, sourceGrounding: z.literal('authored_concept') }), image: z.record(z.string(), z.string()),
}).superRefine((scene, ctx) => {
  const policy = (policies.concepts as Record<string, { kind: string; controls: unknown }>)[scene.conceptId];
  const pinned = (savedScenes as Record<string, { scene: unknown }>)[scene.conceptId];
  if (!policy || policy.kind !== scene.kind || canonical(policy.controls) !== canonical(scene.controls) || !pinned || canonical(pinned.scene) !== canonical(scene)) ctx.addIssue({ code: 'custom', message: 'Scene differs from the pinned saved CAM model.' });
});
export const CamCanvasSchema = z.strictObject({
  artifactId: z.string().regex(/^SCENE-AM-(0[1-9]|10)-canvas$/), renderer: z.literal('cam-concept-canvas/v1'), placardIds: z.array(z.string()).min(1).max(4), scene: CamSceneSchema,
  sources: z.array(source), bindings: z.array(binding).length(2), modelBindings: z.array(binding).length(2),
  behaviorTests: z.array(z.strictObject({ inputs: z.record(z.string(), z.number().finite()), cursor: z.literal(0.25), readouts: z.array(z.array(z.string())), samples: z.array(z.strictObject({ label: z.string(), values: z.array(z.number().finite()).length(6) })), hasExtraSvg: z.boolean() })).min(3).max(7),
  claim: z.literal('ideal_teaching_model'), review: z.strictObject({ scientific: check }),
}).superRefine((artifact, ctx) => {
  const pinned = (savedScenes as Record<string, { sha256: string; bindings: unknown; modelBindings: unknown }>)[artifact.scene.conceptId];
  if (canonical(artifact.bindings) !== canonical(pinned?.bindings) || canonical(artifact.modelBindings) !== canonical(pinned?.modelBindings) || canonical(artifact.sources) !== canonical([artifact.scene.visualBrief.from]) || artifact.review.scientific !== artifact.scene.review.scientific || artifact.artifactId !== artifact.scene.conceptId.replace('C-', 'SCENE-') + '-canvas' || new Set(artifact.placardIds).size !== artifact.placardIds.length || canonical(artifact.behaviorTests) !== canonical((conformance as Record<string, unknown>)[artifact.scene.conceptId]) || !artifact.modelBindings.some(b => b.path.endsWith('/models.js') && b.sha256 === policies.modelsSha256) || !artifact.modelBindings.some(b => b.path.endsWith('/scene.json') && b.sha256 === pinned?.sha256)) ctx.addIssue({ code: 'custom', message: 'CAM scene/model provenance or conformance differs.' });
});
export type CamCanvas = z.infer<typeof CamCanvasSchema>;
export type CamScene = z.infer<typeof CamSceneSchema>;
