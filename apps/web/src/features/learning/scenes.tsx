import type { ReactNode } from 'react'
import type { ConceptLesson, LessonTerm, Placard } from '../../contracts/api'
import type { MediaManifest, SceneArtifact } from '../../contracts/concept-media'
import type { DsbVisual } from '../../contracts/teaching-visual'
import { DsbDiagrams } from './DsbDiagrams'
import { CamCanvas } from './CamCanvas'
import { PhaseRecoveryScene } from './PhaseRecoveryScene'

type TermLinks = { terms: LessonTerm[]; selectedTermId: string | null; onTermOpen(id: string | null): void }

/**
 * Trusted renderer registry. Each renderer is code in this app that implements a known teaching
 * model; lesson data only selects one by ID and supplies validated parameters. Nothing authored
 * or published is ever evaluated or injected as markup.
 */
const RENDERERS = {
  // C-AM-04 keeps its existing lesson.visual projection and placement.
  'dsb-sc-visual/v1': (visual: DsbVisual, links: TermLinks) => <DsbDiagrams visual={visual} {...links} />,
  'coherent-phase-recovery/v1': (scene: Extract<SceneArtifact, { renderer: 'coherent-phase-recovery/v1' }>) => <PhaseRecoveryScene scene={scene} />,
  'cam-concept-canvas/v1': (scene: Extract<SceneArtifact, { renderer: 'cam-concept-canvas/v1' }>) => <CamCanvas artifact={scene} />,
} as const

export type SceneSlot = { key: string; node: ReactNode }

/** The scenes placed on one placard. Text stays complete when there are none. */
export function scenesFor(lesson: ConceptLesson, manifest: MediaManifest | null, placard: Placard, links: TermLinks): SceneSlot[] {
  const slots: SceneSlot[] = []
  if (!manifest?.artifacts.some(a => a.renderer === 'cam-concept-canvas/v1' && a.placardIds.includes(placard.id)) && lesson.visual && (placard.kind === 'concept' || placard.kind === 'application')) {
    slots.push({ key: `${lesson.conceptId}-visual`, node: RENDERERS[lesson.visual.schema](lesson.visual, links) })
  }
  for (const scene of manifest?.artifacts ?? []) {
    if (scene.placardIds.includes(placard.id)) slots.push({ key: scene.artifactId, node: scene.renderer === 'cam-concept-canvas/v1' ? RENDERERS[scene.renderer](scene) : RENDERERS[scene.renderer](scene) })
  }
  if (manifest?.unsupportedArtifacts.some((a) => a.placardIds.includes(placard.id))) {
    slots.push({ key: 'unsupported', node: <p className="helper-note">An interactive for this step needs a newer version of Kiki. The text above is complete.</p> })
  }
  return slots
}
