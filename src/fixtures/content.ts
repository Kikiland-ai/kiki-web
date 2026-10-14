import type { BilingualText, ChapterView, ConceptLesson, Id, LabCheckpointView } from '../contracts'

/** Shape of analog-modulation.json, written by scripts/build-fixtures.mjs. */
export interface FixtureContent {
  meta: {
    fixture: true
    label: string
    generatedBy: string
    /** SHA-256 of each content file it was built from (contract §11). */
    sources: Record<string, string>
    /** Where Odia was missing and English was reused. */
    notes: string[]
  }
  chapter: ChapterView
  lessons: Record<Id, ConceptLesson>
  lab: {
    practicalId: Id
    title: string
    requiredConceptIds: Id[]
    /** False until the experiment has been run end to end in Simulink. */
    executionVerified: boolean
    checkpoints: LabCheckpointView[]
    observationPrompts: BilingualText[]
  }
}

let cached: Promise<FixtureContent> | null = null

/**
 * Loads the generated content on first use. A dynamic import keeps the
 * 180 KB file out of the main bundle; local and live builds never load it.
 */
export function loadFixtureContent(): Promise<FixtureContent> {
  cached ??= import('./analog-modulation.json').then((m) => m.default as unknown as FixtureContent)
  return cached
}
