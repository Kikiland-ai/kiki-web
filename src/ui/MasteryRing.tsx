import type { ReactNode } from 'react'
import type { Dimension, DimensionCoverage } from '../contracts'
import styles from './MasteryRing.module.css'

/** Clockwise from the top. The ring always shows all four, in this order. */
const DIMENSIONS: { key: Dimension; name: string }[] = [
  { key: 'concept', name: 'Concept' },
  { key: 'words', name: 'Words' },
  { key: 'english', name: 'English' },
  { key: 'lab', name: 'Lab' },
]

export type MasteryRingProps = {
  /** Coverage per dimension. A missing or null value is "Not assessed", never 0%. */
  values: Partial<Record<Dimension, DimensionCoverage>>
  /** Pixel size. 44 on the map, 96 in the lesson header. Default 44. */
  size?: number
  /** What the ring is for, e.g. the concept title. Starts the accessible name. */
  label?: string
  /** Show a written key under the ring: each dimension's name and "3 of 5" or "Not assessed". */
  showLegend?: boolean
  /** Centre content, e.g. the concept number. Visual only: put anything important in `label`. */
  children?: ReactNode
}

/** done/total as 0–1, or null when nothing has been assessed. */
function fraction(coverage: DimensionCoverage | undefined) {
  if (!coverage || coverage.total <= 0) return null
  return Math.max(0, Math.min(1, coverage.done / coverage.total))
}

function describe(coverage: DimensionCoverage | undefined) {
  return coverage && coverage.total > 0 ? `${coverage.done} of ${coverage.total}` : 'Not assessed'
}

/**
 * A four-segment ring of evidence for one concept: Concept (green), Words
 * (red), English (yellow), Lab (blue). Ported from Breadboard MasteryRing,
 * with the contract's coverage shape: a segment that hasn't been assessed is
 * drawn dashed and read as "Not assessed", which is different from 0 of 5.
 */
export function MasteryRing({ values, size = 44, label, showLegend = false, children }: MasteryRingProps) {
  const stroke = Math.max(4, Math.round(size * 0.1))
  const r = (size - stroke) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const gap = (size < 48 ? 0.05 : 0.03) * circ
  const segment = circ / 4 - gap

  const noneAssessed = DIMENSIONS.every((d) => fraction(values[d.key]) === null)
  // Big enough to say it in words; small rings rely on the dashed segments and the accessible name
  const centre = children ?? (noneAssessed && size >= 72 ? 'Not assessed' : null)

  const summary = DIMENSIONS.map((d) => `${d.name} ${describe(values[d.key])}`).join(', ')
  const name = label ? `${label}: ${summary}` : summary

  return (
    <div className={styles.wrap}>
      <div className={styles.ring} style={{ width: size, height: size }} role="img" aria-label={name}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
          {DIMENSIONS.map((d, i) => {
            const v = fraction(values[d.key])
            const offset = -(i * (circ / 4) + gap / 2)
            const common = { cx: c, cy: c, r, strokeDashoffset: offset }
            if (v === null) {
              // Not assessed: a thin dashed segment, so it can't be read as an empty 0%
              const dash = Math.max(2, stroke * 0.5)
              const space = Math.max(3, stroke * 0.6)
              const parts: number[] = []
              for (let used = 0; used + dash <= segment; used += dash + space) parts.push(dash, space)
              if (parts.length === 0) parts.push(segment, circ)
              else parts[parts.length - 1] = circ
              return (
                <circle
                  key={d.key}
                  {...common}
                  className={styles.unassessed}
                  strokeWidth={Math.max(2, stroke * 0.45)}
                  strokeDasharray={parts.join(' ')}
                />
              )
            }
            return (
              <g key={d.key}>
                <circle {...common} className={styles.track} strokeWidth={stroke} strokeDasharray={`${segment} ${circ}`} />
                {v > 0 && (
                  <circle
                    {...common}
                    className={`${styles.fill} ${styles[d.key]}`}
                    strokeWidth={stroke}
                    strokeDasharray={`${v * segment} ${circ}`}
                  />
                )}
              </g>
            )
          })}
        </svg>
        {centre && (
          <div className={styles.center} aria-hidden="true">
            {centre}
          </div>
        )}
      </div>
      {showLegend && (
        <ul className={styles.legend} aria-hidden="true">
          {DIMENSIONS.map((d) => (
            <li key={d.key}>
              <span className={`${styles.swatch} ${styles[d.key]}`} />
              {d.name}: {describe(values[d.key])}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
