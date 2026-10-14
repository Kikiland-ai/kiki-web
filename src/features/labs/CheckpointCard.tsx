import type { DialLevel, LabCheckpointView } from '../../contracts'
import { Button } from '../../ui'
import { pick } from '../learning/language'
import styles from './LabTrackerScreen.module.css'

const EVIDENCE: Record<LabCheckpointView['evidenceKind'], string> = {
  workspace: 'the open model',
  model_structure: 'the blocks and wires',
  parameters: 'block settings',
  run_result: 'a simulation run',
  waveform: 'the scope waveforms',
  observation: 'your recorded observation',
  explanation: 'your explanation',
}

export type CheckpointCardProps = {
  checkpoint: LabCheckpointView
  dial: DialLevel
  busy: boolean
  /** Why the student can't tick this step yet; null when they can. */
  blockedReason: string | null
  onDone: () => void
}

/** The current step: one action, why it matters, what to expect, and the student's tick. */
export function CheckpointCard({ checkpoint, dial, busy, blockedReason, onDone }: CheckpointCardProps) {
  const instruction = pick(checkpoint.instruction, dial)
  const why = pick(checkpoint.why, dial)
  return (
    <>
      <p className={styles.target}>In Simulink: {checkpoint.targetLabel}</p>
      <h3 className={styles.instruction} lang={instruction.lang}>
        {instruction.text}
      </h3>
      {dial === 3 && <p className={styles.alsoEnglish}>{checkpoint.instruction.en}</p>}
      <p lang={why.lang}>
        <strong>Why: </strong>
        {why.text}
      </p>
      <p>
        <strong>You should see: </strong>
        {checkpoint.expected}
      </p>
      <p className={styles.evidenceNote}>Checked from {EVIDENCE[checkpoint.evidenceKind]}.</p>
      {blockedReason ? (
        <p className={styles.blocked}>{blockedReason}</p>
      ) : (
        <div className={styles.row}>
          <Button onClick={onDone} disabled={busy}>
            I've done this step
          </Button>
          <p className={styles.evidenceNote}>Saved as your own tick. Only the Kiki extension can verify a step.</p>
        </div>
      )}
    </>
  )
}
