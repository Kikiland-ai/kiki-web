import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { ChapterProgress, ChapterView, ConceptProgress } from '../../contracts/api'
import { ServiceError, readableError } from '../../services/types'
import { useSession } from '../../app/Session'
import { ErrorState, LinkButton, LoadingState, MapNode, MasteryRing, StatusBadge } from '../../ui/learning'
import { LabIcon } from '../../ui/learning/icons'
import { lacksOdia } from './language'
import { nextConceptId } from './nextConcept'
import { useMediaQuery } from './useMediaQuery'
import styles from './ChapterMapScreen.module.css'

type Load =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; chapter: ChapterView; progress: ChapterProgress }

/**
 * The chapter map (/chapters/:planId): every concept grouped by section, with
 * its status, what to study next and how far the lab is. Tiles from 600px up;
 * a list on phones.
 */
export function ChapterMapScreen() {
  const { planId = '' } = useParams()
  const { services, profile } = useSession()
  const uid = profile?.id
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const wide = useMediaQuery('(min-width: 600px)')

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoad({ status: 'loading' })
    const api = services.learning
    Promise.all([api.getChapter(planId, controller.signal), api.getProgress(planId, controller.signal)])
      .then(([chapter, progress]) => {
        if (!current || controller.signal.aborted) return
        if (progress.ownerLearnerId !== uid) throw new ServiceError('The progress does not match your account.')
        setLoad({ status: 'ready', chapter, progress })
      })
      .catch((error: unknown) => {
        if (!current) return
        setLoad({ message: readableError(error), status: error instanceof ServiceError && error.status === 404 && services.mode === 'fixture' ? 'not_found' : 'error' })
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [planId, attempt, services, uid])

  if (load.status === 'loading') return <LoadingState message="Loading your chapter…" />
  if (load.status === 'not_found') {
    return (
      <section>
        <h1>Chapter not found</h1>
        <p>This chapter isn't in your course. Go back to Home to pick up where you left off.</p>
        <LinkButton to="/home" variant="secondary">
          Go to Home
        </LinkButton>
      </section>
    )
  }
  if (load.status === 'error') {
    return <ErrorState message={load.message} onRetry={() => setAttempt((n) => n + 1)} />
  }

  const { chapter, progress } = load
  const status = new Map<string, ConceptProgress>(progress.concepts.map((c) => [c.conceptId, c]))
  const passed = progress.concepts.filter((c) => c.status === 'passed').length
  const nextId = nextConceptId(chapter, progress)
  const next = chapter.concepts.find((c) => c.id === nextId)
  const titleOr = (t: { en: string; or: string }) => (lacksOdia(t) ? undefined : t.or)
  const sections = [...chapter.broadConcepts].sort((a, b) => a.order - b.order)

  return (
    <div className={`learning-scope ${styles.screen}`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{chapter.title.en}</h1>
          {chapter.review.content === 'draft' && <StatusBadge label="Draft content" />}
          {services.mode === 'fixture' && <p className="helper-note">Sample chapter content. Progress comes from your saved preview checks, including any explicitly loaded preview setup.</p>}
          <p className="helper-note">Curated chapter content. This chapter is not extracted from your uploaded files.</p>
        </div>
        <div className={styles.summary}>
          <MasteryRing values={progress.rings} size={96} label="This chapter" showLegend>
            {passed}/{chapter.concepts.length}
          </MasteryRing>
          <div className={styles.summaryText}>
            <p>
              <strong>
                {passed} of {chapter.concepts.length}
              </strong>{' '}
              concept checks passed
            </p>
            {next && <LinkButton to={`/concepts/${next.id}`}>Continue: {next.title.en}</LinkButton>}
          </div>
        </div>
      </header>

      {progress.labReadiness && (
        <section className={styles.lab} aria-labelledby="lab-title">
          <h2 id="lab-title" className={styles.labTitle}>
            <LabIcon />
            DSB-SC lab
          </h2>
          {progress.labReadiness.ready ? (
            <>
              <StatusBadge label="Ready" tone="success" dimension="lab" />
              <p>All seven concept checks the lab needs have passed.</p>
              <LinkButton to="/labs" variant="secondary">
                Open the lab
              </LinkButton>
            </>
          ) : (
            <>
              <p>
                Pass {progress.labReadiness.missingConceptIds.length} more concept{' '}
                {progress.labReadiness.missingConceptIds.length === 1 ? 'check' : 'checks'} to start the guided steps:
              </p>
              <details><summary>View missing concept checks ({progress.labReadiness.missingConceptIds.length})</summary><ul className={styles.missing}>
                {progress.labReadiness.missingConceptIds.map((id) => {
                  const c = chapter.concepts.find((x) => x.id === id)
                  return (
                    <li key={id}>
                      <Link to={`/concepts/${id}`}>
                        {c?.order}. {c?.title.en ?? id}
                      </Link>
                    </li>
                  )
                })}
              </ul></details>
              <LinkButton to="/labs" variant="text">
                Prepare for the lab
              </LinkButton>
            </>
          )}
        </section>
      )}

      {sections.map((section) => {
        const concepts = chapter.concepts
          .filter((c) => c.broadConceptId === section.id)
          .sort((a, b) => a.order - b.order)
        return (
          <section key={section.id} className={styles.section} aria-labelledby={`section-${section.id}`}>
            <h2 id={`section-${section.id}`} className={styles.sectionTitle}>
              {section.title.en}
            </h2>
            <ol className={wide ? styles.tiles : styles.rows}>
              {concepts.map((c) => {
                const p = status.get(c.id)
                const percent = p?.theoryCheck.attemptPercent
                return (
                  <li key={c.id}>
                    <MapNode
                      layout={wide ? 'tile' : 'row'}
                      to={`/concepts/${c.id}`}
                      order={c.order}
                      title={c.title.en}
                      titleOr={titleOr(c.title)}
                      status={p?.status ?? 'not_started'}
                      rings={{ concept: percent === undefined ? null : { done: p?.status === 'passed' ? 1 : 0, total: 1 } }}
                      checkPercent={percent}
                      prerequisiteNote={c.prerequisiteIds.some(id => status.get(id)?.status !== 'passed') ? `Prerequisite checks pending: ${c.prerequisiteIds.filter(id => status.get(id)?.status !== 'passed').map(id => chapter.concepts.find(row => row.id === id)?.title.en ?? id).join(', ')}` : undefined}
                      next={c.id === nextId}
                      requiredForLab={c.requiredForLab}
                    />
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}

      <section className={styles.test} aria-labelledby="test-title">
        <h2 id="test-title">Chapter test</h2>
        <p>Ten questions across the chapter; pass with 8 of 10. It doesn't affect the lab.</p>
        {passed === chapter.concepts.length ? <LinkButton to={`/assessments/${chapter.chapterAssessmentId}/new`} variant="secondary">
          Take the chapter test
        </LinkButton> : <><p>Pass all ten concept checks at 60% or above to unlock this test.</p><button className="button button-secondary" disabled>Chapter test locked</button></>}
      </section>
    </div>
  )
}
