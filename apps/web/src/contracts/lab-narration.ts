import { z } from 'zod';
import type { LoadedMedia } from './services';

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const Clip = z.object({ assetId: Sha256, bytes: z.number().int().positive().max(5_000_000) });

export const LabNarrationManifestSchema = z.object({
  schema: z.literal('lab-narration/v1'),
  experimentId: z.literal('PR-AM-DSB'),
  procedureVersion: z.string().min(1).max(80),
  profileId: z.literal('odia7-english5'),
  revision: Sha256,
  clips: z.record(z.string().regex(/^CP-DSB-\d{2}\/[a-z0-9-]+$/), Clip),
});
export type LabNarrationManifest = z.infer<typeof LabNarrationManifestSchema>;
export type LabNarrationClip = z.infer<typeof Clip>;

export const PhysicalLabNarrationManifestSchema = z.object({
  schema: z.literal('physical-lab-narration/v1'),
  experimentId: z.literal('dsb-sc-trainer'),
  packVersion: z.string().min(1).max(80),
  packSha256: Sha256,
  mode: z.literal('experiment_demo'),
  profileId: z.literal('odia7-english5'),
  revision: Sha256,
  clips: z.record(z.string().regex(/^[a-z0-9-]+$/), Clip),
});
export type PhysicalLabNarrationManifest = z.infer<typeof PhysicalLabNarrationManifestSchema>;

export interface LabNarrationApi<Manifest = LabNarrationManifest> {
  manifest(scopeId: string, signal: AbortSignal): Promise<Manifest>;
  clip(scopeId: string, revision: string, clip: LabNarrationClip, signal: AbortSignal): Promise<LoadedMedia>;
}
