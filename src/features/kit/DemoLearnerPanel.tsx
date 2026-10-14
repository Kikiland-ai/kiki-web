import { useEffect, useState } from 'react'
import { isFixtureMode } from '../../config/mode'
import type { ChapterProgress, ConceptProgress } from '../../contracts'
import { fixtureStore, recordConceptCheck, type FixtureStore } from '../../fixtures'
import { Button, ErrorState, LinkButton, LoadingState, StatusBadge, type StatusTone } from '../../ui'
import { learningApi } from '../learning/services'
import styles from './KitScreen.module.css'

const PLAN_ID = 'LP-ANALOG-MODULATION'
const CONCEPT_ID = 'C-AM-08'
const ASSESSMENT_ID = 'AS-AM-08'

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; progress: ChapterProgress }

function checkBadge(concept: ConceptProgress | undefined): { label: string; tone: StatusTone } {
  const check = concept?.theoryCheck
  if (check?.status === 'passed') return { label: `Passed (${check.attemptPercent}%)`, tone: 'success' }
  if (check?.status === 'revisit') return { label: `Not yet (${check.attemptPercent}%)`, tone: 'not_yet' }
  return { label: 'Not taken yet', tone: 'neutral' }
}

export type DemoLearnerPanelProps = {
  /** The fixture store to change; tests pass their own. */
  store?: FixtureStore
}

/**
 * Dev-only demo aid: passes C-AM-08 for the fixture learner, as the quiz
 * fixture will once it calls recordConceptCheck(), and resets the learner for
 * rehearsals. Fixture mode only; it never touches live data.
 */
export function DemoLearnerPanel({ store = fixtureStore }: DemoLearnerPanelProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isFixtureMode) return
    let current = true
    learningApi()
      .getProgress(PLAN_ID)
      .then((progress) => current && setLoad({ status: 'ready', progress }))
      .catch(() => current && setLoad({ status: 'error' }))
    return () => {
      current = false
    }
  }, [attempt])

  if (!isFixtureMode) {
    return <p className={styles.note}>Only in fixture mode. Live and local data can't be changed from here.</p>
  }
  if (load.status === 'loading') return <LoadingState message="Loading the demo learner…" />
  if (load.status === 'error') {
    return <ErrorState message="Couldn't load the demo learner." onRetry={() => setAttempt((n) => n + 1)} />
  }

  const { progress } = load
  const check = progress.concepts.find((c) => c.conceptId === CONCEPT_ID)
  const badge = checkBadge(check)
  const readiness = progress.labReadiness
  const passed = check?.theoryCheck.status === 'passed'

  function markPassed() {
    const runs = store.read().conceptChecks[CONCEPT_ID]?.length ?? 0
    recordConceptCheck(
      CONCEPT_ID,
      {
        runId: `FIXTURE-RUN-AM-08-DEMO-${runs + 1}`,
        assessmentId: ASSESSMENT_ID,
        correct: 4,
        total: 5,
        completedAt: new Date().toISOString(),
      },
      store,
    )
    setMessage('C-AM-08 marked passed with 4 of 5.')
    setAttempt((n) => n + 1)
  }

  function reset() {
    store.reset()
    setMessage('Demo learner reset: six checks passed, C-AM-08 next, no lesson position, no lab sessions.')
    setAttempt((n) => n + 1)
  }

  return (
    <div className={styles.list}>
      <p className={styles.note}>
        Changes the fixture learner in this browser. Close other Kiki tabs first: each tab keeps its own copy and
        can write it back. The language dial is kept.
      </p>
      <div className={styles.row}>
        <span>C-AM-08 concept check</span>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </div>
      <div className={styles.row}>
        <span>DSB-SC lab</span>
        {readiness?.ready ? (
          <StatusBadge label="Ready" tone="success" dimension="lab" />
        ) : (
          <StatusBadge label={`Needs ${readiness?.missingConceptIds.join(', ') || 'checks'}`} />
        )}
      </div>
      <div className={styles.row}>
        <Button onClick={markPassed} disabled={passed}>
          Mark C-AM-08 passed
        </Button>
        <Button variant="secondary" onClick={reset}>
          Reset demo learner
        </Button>
      </div>
      <p role="status" className={styles.note}>
        {message}
      </p>
      <div className={styles.row}>
        <LinkButton variant="text" to={`/chapters/${PLAN_ID}`}>
          Chapter map
        </LinkButton>
        <LinkButton variant="text" to="/labs">
          Lab mode
        </LinkButton>
      </div>
    </div>
  )
}
