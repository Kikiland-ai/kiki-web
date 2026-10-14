import { useId, useState, type FormEvent } from 'react'
import type { DialLevel, LabObservation } from '../../contracts'
import { Button } from '../../ui'
import { pick } from '../learning/language'
import { DSB_SC } from './experiment'
import styles from './LabTrackerScreen.module.css'

export type ObservationsPanelProps = {
  observations: LabObservation[]
  dial: DialLevel
  /** Only the device running the lab can add observations. */
  canAdd: boolean
  busy: boolean
  onAdd: (entry: { condition: string; result: string; receiverPhaseOffsetDeg?: number }) => Promise<void>
}

/** What the student saw, in their own words, saved with the session. */
export function ObservationsPanel({ observations, dial, canAdd, busy, onAdd }: ObservationsPanelProps) {
  const id = useId()
  const [condition, setCondition] = useState('')
  const [result, setResult] = useState('')
  const [phase, setPhase] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!condition.trim() || !result.trim()) return
    const offset = phase.trim() === '' ? undefined : Number(phase)
    await onAdd({
      condition: condition.trim(),
      result: result.trim(),
      ...(offset !== undefined && Number.isFinite(offset) && { receiverPhaseOffsetDeg: offset }),
    })
    setCondition('')
    setResult('')
    setPhase('')
  }

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.panelTitle}>
        Observations
      </h2>
      <ul className={styles.prompts}>
        {DSB_SC.observationPrompts.map((p) => {
          const t = pick(p, dial)
          return (
            <li key={p.en} lang={t.lang}>
              {t.text}
            </li>
          )
        })}
      </ul>

      {observations.length > 0 ? (
        <ul className={styles.observations}>
          {observations.map((o) => (
            <li key={o.id}>
              <p className={styles.obsCondition}>{o.condition}</p>
              <p>{o.result}</p>
              {o.receiverPhaseOffsetDeg !== undefined && <p>Receiver phase: {o.receiverPhaseOffsetDeg}°</p>}
              <p className={styles.evidenceNote}>{o.source === 'student_report' ? 'Your entry' : 'Recorded by the extension'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.evidenceNote}>No observations saved yet.</p>
      )}

      {canAdd && (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            <span>Condition</span>
            <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="e.g. Baseline, or 90° receiver phase" required />
          </label>
          <label className={styles.field}>
            <span>What you saw</span>
            <textarea value={result} onChange={(e) => setResult(e.target.value)} rows={3} required />
          </label>
          <label className={styles.field}>
            <span>Receiver phase in degrees (optional)</span>
            <input value={phase} onChange={(e) => setPhase(e.target.value)} inputMode="decimal" />
          </label>
          <Button type="submit" variant="secondary" disabled={busy || !condition.trim() || !result.trim()}>
            Save observation
          </Button>
        </form>
      )}
    </section>
  )
}
