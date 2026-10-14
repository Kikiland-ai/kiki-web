import type { Dimension, DimensionCoverage } from '../contracts'

/** Clockwise from the top. Mastery always lists all four, in this order. */
export const MASTERY_DIMENSIONS: { key: Dimension; name: string }[] = [
  { key: 'concept', name: 'Concept' },
  { key: 'words', name: 'Words' },
  { key: 'english', name: 'English' },
  { key: 'lab', name: 'Lab' },
]

export type MasteryValues = Partial<Record<Dimension, DimensionCoverage>>

/** done/total as 0–1, or null when nothing has been assessed. */
export function coverageFraction(coverage: DimensionCoverage | undefined): number | null {
  if (!coverage || coverage.total <= 0) return null
  return Math.max(0, Math.min(1, coverage.done / coverage.total))
}

/** "3 of 5", or "Not assessed" (never 0%) for a missing or empty value. */
export function describeCoverage(coverage: DimensionCoverage | undefined): string {
  return coverage && coverage.total > 0 ? `${coverage.done} of ${coverage.total}` : 'Not assessed'
}

/** "Concept 3 of 5, Words Not assessed, English Not assessed, Lab Not assessed" */
export function describeMastery(values: MasteryValues): string {
  return MASTERY_DIMENSIONS.map((d) => `${d.name} ${describeCoverage(values[d.key])}`).join(', ')
}
