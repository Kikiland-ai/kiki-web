import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { ChapterProgress, ChapterView, LabSession } from '../../contracts'
import { Button, ErrorState, LoadingState, StatusBadge } from '../../ui'
import { CheckIcon } from '../../ui/icons'
import { learningApi } from '../learning/services'
import { DSB_SC } from './experiment'
import { deviceId, labApi } from './services'
import styles from './LabHomeScreen.module.css'

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; chapter: ChapterView; progress: ChapterProgress; active: LabSession | null }

/**
 * Lab mode (/labs): the DSB-SC experiment, which concept checks it needs, and
 * Start or Resume. Preparation is open at any time; only guided execution
 * needs the seven checks. Opening Lab mode never turns Kiki's pointer on.
 */
export function LabHomeScreen() {
  const navigate = useNavigate()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [starting, setStarting] = useState(false)
  const [startFailed, setStartFailed] = useState(false)

  useEffect(() => {
    let current = true
    setLoad({ status: 'loading' })
    Promise.all([
      learningApi().getChapter(DSB_SC.planId),
      learningApi().getProgress(DSB_SC.planId),
      labApi().getActive(DSB_SC.practicalId),
    ])
      .then(([chapter, progress, active]) => current && setLoad({ status: 'ready', chapter, progress, active }))
      .catch(() => current && setLoad({ status: 'error' }))
    return () => {
      current = false
    }
  }, [attempt])

  if (load.status === 'loading') return <LoadingState message="Loading Lab mode…" />
  if (load.status === 'error') {
    return <ErrorState message="Couldn't load Lab mode. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
  }

  const { chapter, progress, active } = load
  const readiness = progress.labReadiness
  const missing = new Set(readiness?.missingConceptIds ?? [])
  const required = chapter.concepts.filter((c) => c.requiredForLab)
  const doneSteps = active ? new Set(active.evidence.map((e) => e.checkpointId)).size : 0

  async function start() {
    setStarting(true)
    setStartFailed(false)
    try {
      const session = await labApi().start(DSB_SC.practicalId, deviceId())
      navigate(`/labs/${session.id}`)
    } catch {
      setStartFailed(true)
      setStarting(false)
    }
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Lab mode</h1>

      <section className={styles.card} aria-labelledby="experiment-title">
        <p className={styles.eyebrow}>Practical · Analog Modulation</p>
        <h2 id="experiment-title" className={styles.cardTitle}>
          {DSB_SC.title}
        </h2>
        <p>{DSB_SC.aim}</p>
        <dl className={styles.facts}>
          <div>
            <dt>Software</dt>
            <dd>{DSB_SC.software}. You sign in to MathWorks separately.</dd>
          </div>
          <div>
            <dt>Steps</dt>
            <dd>{active ? `${doneSteps} of ${DSB_SC.steps} done` : `${DSB_SC.steps} guided steps`}</dd>
          </div>
        </dl>

        {readiness && (
          <div className={styles.readiness}>
            <div className={styles.readinessHead}>
              <h3 className={styles.readinessTitle}>Concept checks the lab needs</h3>
              {readiness.ready ? (
                <StatusBadge label="All 7 passed" tone="success" dimension="lab" />
              ) : (
                <StatusBadge label={`${missing.size} to go`} tone="not_yet" />
              )}
            </div>
            <ul className={styles.required}>
              {required.map((c) => (
                <li key={c.id} className={missing.has(c.id) ? styles.missing : styles.passed}>
                  {missing.has(c.id) ? (
                    <>
                      <span className={styles.mark} aria-hidden="true" />
                      <Link to={`/concepts/${c.id}`}>
                        {c.order}. {c.title.en}
                      </Link>
                      <span className={styles.srOnly}>, not passed yet</span>
                    </>
                  ) : (
                    <>
                      <CheckIcon size={18} />
                      <span>
                        {c.order}. {c.title.en}
                      </span>
                      <span className={styles.srOnly}>, passed</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {!readiness.ready && (
              <p className={styles.note}>
                You can start now to read the steps and plan. Guided building opens once these checks pass.
              </p>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <Button onClick={start} disabled={starting}>
            {active ? 'Resume the lab' : 'Start the experiment'}
          </Button>
        </div>
        {startFailed && <ErrorState message="Couldn't open the lab. Check your connection." onRetry={start} />}
      </section>

      <p className={styles.note}>
        Kiki's pointer works in desktop Chrome with the Kiki extension. Without it, you follow the written Manual guide;
        your steps and observations are saved the same way.
      </p>
    </div>
  )
}
