import type { ReactNode } from 'react'
import { CheckIcon } from './icons'
import styles from './LabStepper.module.css'

export type LabStepState = 'done' | 'current' | 'upcoming'

export type LabStep = {
  id: string
  number: number
  label: ReactNode
  state: LabStepState
  /** For done steps: verified by the tool, or the student's own tick (never shown as verified). */
  evidence?: 'verified' | 'self_reported'
}

export type LabStepperProps = {
  steps: LabStep[]
  /** The current step's card: instruction, why, and its actions. */
  children?: ReactNode
  /** How many upcoming steps to show before folding the rest. Default 2 (design system: the step now and the next two). */
  ahead?: number
  /** Accessible name for the list, e.g. "DSB-SC steps". */
  label: string
}

/**
 * The lab's path ahead: done steps ticked with their evidence, the current
 * step's card, the next two as dashed ghost steps, and the rest folded into a
 * count. Ported from the Kiki guide grammar (step now, steps ahead, done).
 */
export function LabStepper({ steps, children, ahead = 2, label }: LabStepperProps) {
  const upcoming = steps.filter((s) => s.state === 'upcoming')
  const shownAhead = new Set(upcoming.slice(0, ahead).map((s) => s.id))
  const hidden = upcoming.length - shownAhead.size

  return (
    <ol className={styles.stepper} aria-label={label}>
      {steps
        .filter((s) => s.state !== 'upcoming' || shownAhead.has(s.id))
        .map((s) => (
          <li
            key={s.id}
            className={[styles.step, styles[s.state], s.state === 'done' && s.evidence === 'verified' && styles.isVerified]
              .filter(Boolean)
              .join(' ')}
            aria-current={s.state === 'current' ? 'step' : undefined}
          >
            <span className={styles.marker} aria-hidden="true">
              {s.state === 'done' ? <CheckIcon size={16} /> : s.number}
            </span>
            <div className={styles.main}>
              <p className={styles.label}>
                <span className={styles.srOnly}>
                  Step {s.number}
                  {s.state === 'done' ? ', done' : s.state === 'current' ? ', now' : ', coming up'}:{' '}
                </span>
                {s.label}
                {s.state === 'done' && (
                  <span className={s.evidence === 'verified' ? styles.verified : styles.selfReported}>
                    {s.evidence === 'verified' ? 'Verified' : 'Your tick'}
                  </span>
                )}
              </p>
              {s.state === 'current' && children && <div className={styles.card}>{children}</div>}
            </div>
          </li>
        ))}
      {hidden > 0 && (
        <li className={`${styles.step} ${styles.more}`}>
          <span className={styles.marker} aria-hidden="true">
            +{hidden}
          </span>
          <div className={styles.main}>
            <p className={styles.label}>
              {hidden} more {hidden === 1 ? 'step' : 'steps'} after these
            </p>
          </div>
        </li>
      )}
    </ol>
  )
}
