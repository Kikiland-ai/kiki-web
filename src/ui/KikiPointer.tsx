import type { CSSProperties } from 'react'
import type { Dimension } from '../contracts'
import { KIKI_DOT_FILLS, KIKI_LEAD_DOT } from './kikiDots'
import styles from './KikiPointer.module.css'

export type KikiPointerState =
  | 'idle'
  | 'pointing'
  | 'tapping'
  | 'dragging'
  | 'tracing'
  | 'thinking'
  | 'asking'
  | 'listening'
  | 'celebrating'
  | 'unsure'
  | 'waiting'

/** Dot centres in the 80×80 box, in Google order: blue, red, yellow, green. Ported from Breadboard KikiPointer. */
const DOTS: Record<KikiPointerState, [number, number][]> = {
  idle: [[46, 48], [53, 53], [60, 58], [67, 63]],
  pointing: [[40, 44], [45, 48], [50, 52], [55, 56]],
  tapping: [[46, 48], [53, 53], [60, 58], [67, 63]],
  dragging: [[44, 54], [52, 60], [60, 66], [68, 72]],
  tracing: [[48, 48], [56, 48], [64, 48], [72, 48]],
  thinking: [[26, 4], [54, 32], [26, 60], [-2, 32]],
  asking: [[48, 40], [56, 46], [64, 40], [72, 46]],
  listening: [[46, 46], [53, 46], [60, 46], [67, 46]],
  celebrating: [[64, 6], [76, 34], [66, 72], [34, 76]],
  unsure: [[54, 16], [72, 40], [46, 68], [74, 70]],
  waiting: [[46, 48], [53, 53], [60, 58], [67, 63]],
}

const DEFAULT_LABELS: Record<KikiPointerState, string> = {
  idle: 'Kiki',
  pointing: 'Kiki is pointing here',
  tapping: 'Kiki says: tap here',
  dragging: 'Kiki is showing how to drag this',
  tracing: 'Kiki is reading this word with you',
  thinking: 'Kiki is thinking',
  asking: 'Kiki is asking you a question',
  listening: 'Kiki is listening',
  celebrating: 'Kiki is celebrating',
  unsure: 'Kiki is not sure',
  waiting: 'Kiki is waiting for you here',
}

/** The cursor outline; its tip is at (12, 8). */
const BODY = 'M12 8 L12 46 L21.5 37.5 L28.5 53 L35 50 L28 35 L40 35 Z'

/**
 * Where the cursor tip sits, as a fraction of `size`. To put the tip on a
 * target, place the pointer's top-left at (x - TIP.x × size, y - TIP.y × size).
 */
export const KIKI_POINTER_TIP = { x: 12 / 80, y: 8 / 80 } as const

export type KikiPointerProps = {
  state: KikiPointerState
  /** Pixel size of the square drawing. Default 48 (46 to 56 in the lab, 40 to 48 over lesson content). */
  size?: number
  /** That dimension's dot grows and colours the tap ripple, wait ring and question mark. */
  lead?: Dimension
  /** Mirror to point left. */
  flip?: boolean
  /** Accessible name. Defaults to a description of the state; pass "" when a visible text says the same. */
  label?: string
  className?: string
  /** For placing it, e.g. absolute left/top from KIKI_POINTER_TIP. */
  style?: CSSProperties
}

/**
 * Kiki's guide form: a dark cursor with two eyes and the four dots trailing
 * behind. Lab only (contract §5), and only while `session.pointer.active`;
 * it never stands in for the student's own cursor. Animations stop under
 * prefers-reduced-motion; each state's pose still reads on its own.
 */
export function KikiPointer({ state, size = 48, lead, flip = false, label, className, style }: KikiPointerProps) {
  const dots = DOTS[state] ?? DOTS.idle
  const leadIndex = lead ? KIKI_LEAD_DOT[lead] : -1
  const leadFill = KIKI_DOT_FILLS[Math.max(leadIndex, 0)]
  const name = label ?? DEFAULT_LABELS[state]
  const a11y = name ? { role: 'img', 'aria-label': name } : { 'aria-hidden': true }
  const up = state === 'thinking' || state === 'asking'

  const dotEls = dots.map(([x, y], i) => {
    const r = i === leadIndex ? 4.2 : 3.2
    return (
      <g key={i} className={styles.dotGroup} style={{ transform: `translate(${x}px, ${y}px)` }}>
        <rect
          className={styles.dot}
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          rx={r}
          // CSS variables only resolve in style, not in the fill attribute
          style={{ fill: KIKI_DOT_FILLS[i], animationDelay: `${i * 0.12}s` }}
        />
      </g>
    )
  })

  return (
    <svg
      className={[styles.pointer, styles[state], flip && styles.flip, className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      focusable="false"
      style={style}
      {...a11y}
    >
      {state === 'waiting' && (
        <circle className={styles.waitRing} cx={12} cy={8} r={9} strokeWidth={2.5} strokeDasharray="4 3" style={{ stroke: leadFill }} />
      )}
      {state === 'asking' && (
        <text className={styles.question} x={50} y={30} style={{ fill: leadFill }}>
          ?
        </text>
      )}
      {state === 'tapping' && <circle className={styles.ripple} cx={12} cy={8} r={9} strokeWidth={3} style={{ stroke: leadFill }} />}
      <g className={state === 'thinking' ? styles.orbit : undefined}>{dotEls}</g>
      <g className={styles.body}>
        {state === 'dragging' && <rect className={styles.ghost} x={2} y={0} width={22} height={12} rx={4} strokeWidth={2} />}
        <path className={styles.cursor} d={BODY} strokeWidth={3} strokeLinejoin="round" />
        {state === 'celebrating' ? (
          <g className={styles.happyEyes} strokeWidth={1.8} strokeLinecap="round">
            <path d="M14.8 26 q2.2 -3.2 4.4 0" />
            <path d="M20.8 26 q2.2 -3.2 4.4 0" />
          </g>
        ) : (
          <g className={[styles.eyes, state === 'unsure' && styles.look].filter(Boolean).join(' ')}>
            <circle cx={16.8} cy={up ? 23 : 25} r={2.8} />
            <circle cx={23.4} cy={up ? 23 : 25} r={2.8} />
          </g>
        )}
      </g>
    </svg>
  )
}
