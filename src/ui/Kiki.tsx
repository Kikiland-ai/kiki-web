import type { Dimension } from '../contracts'
import styles from './Kiki.module.css'

export type KikiState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'pointing'
  | 'asking'
  | 'celebrating'
  | 'unsure'
  | 'examiner'

/** Dot centres in a 64×64 box, in Google order: blue, red, yellow, green. Ported from Breadboard Kiki. */
const POSITIONS: Record<KikiState, [number, number][]> = {
  idle: [[24, 24], [40, 24], [24, 40], [40, 40]],
  listening: [[14, 32], [26, 32], [38, 32], [50, 32]],
  thinking: [[14, 34], [26, 34], [38, 34], [50, 34]],
  speaking: [[24, 24], [40, 24], [24, 40], [40, 40]],
  pointing: [[10, 32], [23, 32], [36, 32], [51, 32]],
  asking: [[22, 15], [37, 13], [42, 27], [32, 52]],
  celebrating: [[9, 9], [55, 9], [9, 55], [55, 55]],
  unsure: [[15, 21], [47, 13], [21, 49], [50, 44]],
  examiner: [[14, 32], [26, 32], [38, 32], [50, 32]],
}

const DEFAULT_LABELS: Record<KikiState, string> = {
  idle: 'Kiki',
  listening: 'Kiki is listening',
  thinking: 'Kiki is thinking',
  speaking: 'Kiki is speaking',
  pointing: 'Kiki is pointing',
  asking: 'Kiki is asking a question',
  celebrating: 'Kiki is celebrating',
  unsure: 'Kiki is not sure',
  examiner: 'Kiki in examiner mode',
}

/** Kiki's identity colours, always in this order. They are not the skill colours. */
const DOT_FILLS = ['var(--blue)', 'var(--red)', 'var(--yellow)', 'var(--green)']

/** Which dot grows for each dimension: green concept, red words, yellow English, blue lab. */
const LEAD_DOT: Record<Dimension, number> = { lab: 0, words: 1, english: 2, concept: 3 }

export type KikiProps = {
  state: KikiState
  /** Pixel size of the square drawing. Default 64. */
  size?: number
  /** That dimension's dot grows to show what is being practised. */
  lead?: Dimension
  /** Accessible name. Defaults to a description of the state; pass "" when a visible text says the same. */
  label?: string
  className?: string
}

/**
 * The helper character: four Google-coloured dots that rearrange to show
 * what Kiki is doing. Animations stop under prefers-reduced-motion; each
 * state's arrangement still reads on its own.
 */
export function Kiki({ state, size = 64, lead, label, className }: KikiProps) {
  const positions = POSITIONS[state] ?? POSITIONS.idle
  const leadIndex = lead ? LEAD_DOT[lead] : -1
  const name = label ?? DEFAULT_LABELS[state]
  const a11y = name ? { role: 'img', 'aria-label': name } : { 'aria-hidden': true }

  return (
    <svg
      className={[styles.kiki, styles[state], className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      focusable="false"
      {...a11y}
    >
      {positions.map(([x, y], i) => {
        const examiner = state === 'examiner'
        const r = examiner ? 5 : i === leadIndex ? 8.5 : 7
        const w = examiner ? 10 : r * 2
        return (
          <g key={i} className={styles.dotGroup} style={{ transform: `translate(${x}px, ${y}px)` }}>
            <rect
              className={styles.dot}
              x={-w / 2}
              y={-r}
              width={w}
              height={r * 2}
              rx={examiner ? 2 : r}
              // CSS variables only resolve in style, not in the fill attribute
              style={{ fill: DOT_FILLS[i], animationDelay: `${i * 0.12}s` }}
            />
          </g>
        )
      })}
    </svg>
  )
}
