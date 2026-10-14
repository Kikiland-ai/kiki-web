import type { Dimension } from '../contracts'
import { CheckIcon } from './icons'
import styles from './StatusBadge.module.css'

export type StatusTone = 'neutral' | 'success' | 'not_yet'

export type StatusBadgeProps = {
  /** Always a word ("Passed", "Not yet", "Draft"): colour is never the only signal. */
  label: string
  /** Tints the badge with that dimension's colour; text uses its -ink token. */
  dimension?: Dimension
  /** success adds a tick; not_yet is a dashed pencil outline, never red. */
  tone?: StatusTone
  className?: string
}

/** A small read-only status label for the map, quiz and lab. */
export function StatusBadge({ label, dimension, tone = 'neutral', className }: StatusBadgeProps) {
  const classes = [styles.badge, styles[tone], dimension && styles[dimension], className].filter(Boolean).join(' ')
  return (
    <span className={classes}>
      {tone === 'success' && <CheckIcon size={16} />}
      {label}
    </span>
  )
}
