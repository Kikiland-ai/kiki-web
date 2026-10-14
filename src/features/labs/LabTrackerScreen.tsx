import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { ChapterView, LabSession, SessionHandoff } from '../../contracts'
import { Button, ErrorState, LabStepper, LinkButton, LoadingState, StatusBadge, type LabStep } from '../../ui'
import { ArrowBackIcon } from '../../ui/icons'
import { learningApi } from '../learning/services'
import { useDialLevel } from '../learning/useDialLevel'
import { CheckpointCard } from './CheckpointCard'
import { ConnectPanel } from './ConnectPanel'
import { DSB_SC } from './experiment'
import { ObservationsPanel } from './ObservationsPanel'
import { labApi } from './services'
import { MANUAL_IN_PROGRESS, POINTER_REASON, STATUS_COPY } from './statusCopy'
import { useLabSession } from './useLabSession'
import styles from './LabTrackerScreen.module.css'

/** Step states for the stepper: a step is done once it has any evidence; verified only from the tool. */
function toSteps(session: LabSession, label: (id: string) => string): LabStep[] {
  return session.checkpoints.map((c) => {
    const evidence = session.evidence.filter((e) => e.checkpointId === c.id)
    const verified = evidence.some((e) => e.verdict === 'verified' && e.source !== 'student_report')
    const state = evidence.length > 0 ? 'done' : c.id === session.currentCheckpointId ? 'current' : 'upcoming'
    return { id: c.id, number: c.stepNumber, label: label(c.id), state, evidence: verified ? 'verified' : 'self_reported' }
  })
}

/**
 * The lab tracker (/labs/:sessionId): status in plain words, Simulink set-up,
 * the twelve steps with the current one's card, observations, a link for
 * another device and Finish. Another device running the lab makes this one
 * an observer with "Take control here". Without the extension, the tracker is
 * the Manual guide: written steps, no pointer.
 */
export function LabTrackerScreen() {
  const { sessionId = '' } = useParams()
  const [params] = useSearchParams()
  const handoffId = params.get('handoff') ?? undefined
  const { state, notice, setNotice, busy, act, me, retry } = useLabSession(sessionId)
  const [dial] = useDialLevel()
  const [chapter, setChapter] = useState<ChapterView | null>(null)
  const [handoff, setHandoff] = useState<SessionHandoff | null>(null)

  // Concept titles for the "still to pass" list
  useEffect(() => {
    learningApi()
      .getChapter(DSB_SC.planId)
      .then(setChapter)
      .catch(() => setChapter(null))
  }, [])

  if (state.status === 'loading') return <LoadingState message="Loading your lab…" />
  if (state.status === 'not_found') {
    return (
      <section>
        <h1>Lab session not found</h1>
        <p>This session doesn't exist or isn't yours. Open the lab from Lab mode.</p>
        <LinkButton to="/labs" variant="secondary">
          Go to Lab mode
        </LinkButton>
      </section>
    )
  }
  if (state.status === 'error') {
    return <ErrorState message="Couldn't load this lab. Check your connection." onRetry={retry} />
  }

  const { session } = state
  const setUp = session.software.opened && session.software.workspaceConfirmed
  const status =
    session.status === 'connecting' && setUp && !session.pointer.active ? MANUAL_IN_PROGRESS : STATUS_COPY[session.status]
  const mine = session.control.controllingDeviceId === me
  const completed = session.status === 'completed'
  const current = session.checkpoints.find((c) => c.id === session.currentCheckpointId)
  const doneCount = new Set(session.evidence.map((e) => e.checkpointId)).size
  const allDone = doneCount === session.checkpoints.length
  const conceptTitle = (id: string) => chapter?.concepts.find((c) => c.id === id)?.title.en ?? id
  const checkpointLabel = (id: string) => session.checkpoints.find((c) => c.id === id)?.instruction.en ?? id

  const blockedReason = !mine
    ? 'Another device is running this lab. Take control here to tick steps on this device.'
    : !session.readiness.ready
      ? 'Guided steps open once the concept checks above have passed. You can read ahead now.'
      : !setUp
        ? 'Set up Simulink above first.'
        : session.status === 'paused'
          ? 'The lab is paused.'
          : null

  async function copyLink() {
    setNotice(null)
    try {
      const link = await labApi().createHandoff(session.id, { deviceId: me, expectedRevision: session.revision })
      setHandoff(link)
      await navigator.clipboard?.writeText(`${window.location.origin}${link.path}`).catch(() => {})
    } catch {
      setNotice("Couldn't make a link. Check your connection and try again.")
    }
  }

  return (
    <div className={styles.screen}>
      <Link to="/labs" className={styles.back}>
        <ArrowBackIcon size={20} />
        Lab mode
      </Link>

      <header className={styles.header}>
        <p className={styles.eyebrow}>Practical · {DSB_SC.software}</p>
        <h1 className={styles.title}>{DSB_SC.title}</h1>
        <div className={styles.badges}>
          <StatusBadge label={status.label} tone={status.tone} dimension={completed ? 'lab' : undefined} />
          <StatusBadge label="Manual guide" />
          <StatusBadge label={`${doneCount} of ${session.checkpoints.length} steps done`} />
        </div>
        <p className={styles.detail}>{status.detail}</p>
        {!session.pointer.active && !completed && (
          <details className={styles.why}>
            <summary>Why Kiki's pointer is off</summary>
            <ul>
              {session.pointer.reasons.map((r) => (
                <li key={r}>{POINTER_REASON[r]}</li>
              ))}
            </ul>
          </details>
        )}
      </header>

      <div role="status" className={notice ? styles.notice : styles.srOnly}>
        {notice}
      </div>

      {!mine && !completed && (
        <section className={styles.observer} aria-labelledby="observer-title">
          <h2 id="observer-title" className={styles.panelTitle}>
            Running on another device
          </h2>
          <p>
            {current ? `Now on step ${current.stepNumber}: ${current.instruction.en}` : 'All steps are done.'}{' '}
            {session.observations.length} {session.observations.length === 1 ? 'observation' : 'observations'} saved.
          </p>
          <Button
            onClick={() => act((s, base) => labApi().takeControl(s.id, { ...base, handoffId }), 'This device is now running the lab.')}
            disabled={busy}
          >
            {handoffId ? 'Continue this lab here' : 'Take control here'}
          </Button>
          <p className={styles.evidenceNote}>
            The other device stops guiding. You'll open Simulink again on this device; finished steps stay saved.
          </p>
        </section>
      )}

      {session.status === 'preparing' && (
        <section className={styles.panel} aria-labelledby="prepare-title">
          <h2 id="prepare-title" className={styles.panelTitle}>
            Before the guided steps
          </h2>
          <p>Pass these concept checks to open guided building. Reading the steps below is open now.</p>
          <ul className={styles.missing}>
            {session.readiness.missingConceptIds.map((id) => (
              <li key={id}>
                <Link to={`/concepts/${id}`}>{conceptTitle(id)}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine && !completed && session.readiness.ready && (
        <ConnectPanel
          session={session}
          busy={busy}
          onOpened={() => act((s, base) => labApi().updateConnection(s.id, { ...base, software: { opened: true } }))}
          onModelConfirmed={() =>
            act((s, base) =>
              labApi().updateConnection(s.id, {
                ...base,
                software: { workspaceConfirmed: true, projectSaved: true, projectRef: 'DSB-SC model' },
              }),
            )
          }
          onReconnect={() =>
            act((s, base) => labApi().updateConnection(s.id, { ...base, connection: { state: 'inactive' } }))
          }
        />
      )}

      <section className={styles.panel} aria-labelledby="steps-title">
        <h2 id="steps-title" className={styles.panelTitle}>
          Steps
        </h2>
        <LabStepper label="DSB-SC steps" steps={toSteps(session, checkpointLabel)}>
          {current && !completed && (
            <CheckpointCard
              checkpoint={current}
              dial={dial}
              busy={busy}
              blockedReason={blockedReason}
              onDone={() =>
                act(
                  (s, base) =>
                    labApi().addEvidence(s.id, {
                      ...base,
                      checkpointId: current.id,
                      source: 'student_report',
                      summary: 'Student ticked the step in the Manual guide.',
                    }),
                  `Step ${current.stepNumber} saved.`,
                )
              }
            />
          )}
        </LabStepper>
        {allDone && !completed && <p>All {session.checkpoints.length} steps are done. Add your observations, then finish.</p>}
      </section>

      <ObservationsPanel
        observations={session.observations}
        dial={dial}
        canAdd={mine && !completed}
        busy={busy}
        onAdd={(entry) => act((s, base) => labApi().addObservation(s.id, { ...base, ...entry }), 'Observation saved.')}
      />

      {mine && !completed && (
        <section className={styles.panel} aria-labelledby="device-title">
          <h2 id="device-title" className={styles.panelTitle}>
            Carry on elsewhere, or finish
          </h2>
          <p>
            The simplest way to continue on another device is to sign in there and choose Resume the lab. A link works too.
          </p>
          <div className={styles.row}>
            <Button variant="secondary" onClick={copyLink} disabled={busy}>
              Copy a link for another device
            </Button>
            <Button
              variant={allDone ? 'primary' : 'secondary'}
              disabled={busy || !allDone}
              onClick={() => act((s, base) => labApi().finish(s.id, base), 'Lab finished. Your work is saved.')}
            >
              Finish the lab
            </Button>
          </div>
          {!allDone && <p className={styles.evidenceNote}>Finish opens after all {session.checkpoints.length} steps.</p>}
          {handoff && (
            <div className={styles.handoff}>
              <p>
                Link copied. It opens this lab on a device signed in to your account until{' '}
                {new Date(handoff.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              </p>
              <label className={styles.field}>
                <span>Session link</span>
                <input readOnly value={`${window.location.origin}${handoff.path}`} onFocus={(e) => e.currentTarget.select()} />
              </label>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
