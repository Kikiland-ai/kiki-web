import type { ChapterProgress, ChapterView, Id } from '../../contracts'

/**
 * The concept to study next, shown as "Up next" on the map and behind
 * "Continue". In order of preference:
 * 1. a lab concept whose check needs revisiting;
 * 2. a concept the student has started (learning);
 * 3. the first lab concept still missing whose prerequisites have passed;
 * 4. the first unpassed concept whose prerequisites have passed.
 * Null when every concept has passed.
 */
export function nextConceptId(chapter: ChapterView, progress: ChapterProgress): Id | null {
  const status = new Map(progress.concepts.map((c) => [c.conceptId, c.status]))
  const passed = (id: Id) => status.get(id) === 'passed'
  const ready = (id: Id) => chapter.concepts.find((c) => c.id === id)?.prerequisiteIds.every(passed) ?? false
  const ordered = [...chapter.concepts].sort((a, b) => a.order - b.order)
  const missingForLab = new Set(progress.labReadiness?.missingConceptIds ?? [])

  return (
    ordered.find((c) => c.requiredForLab && status.get(c.id) === 'revisit')?.id ??
    ordered.find((c) => status.get(c.id) === 'learning')?.id ??
    ordered.find((c) => missingForLab.has(c.id) && ready(c.id))?.id ??
    ordered.find((c) => !passed(c.id) && ready(c.id))?.id ??
    null
  )
}
