import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { ChapterProgress, ChapterView, ConceptLesson } from '../../contracts'
import { ServiceError } from '../../fixtures'
import { Button, ErrorState, LanguageDial, LinkButton, LoadingState, StatusBadge, TermChip } from '../../ui'
import { ArrowBackIcon, ArrowForwardIcon } from '../../ui/icons'
import { lacksOdia, pick, placardMode, shouldShowKeyIdea } from './language'
import { PlacardText } from './PlacardText'
import { learningApi } from './services'
import { useDialLevel } from './useDialLevel'
import styles from './LessonScreen.module.css'

type Load =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error' }
  | { status: 'ready'; lesson: ConceptLesson; chapter: ChapterView; progress: ChapterProgress }

/**
 * A concept lesson (/concepts/:conceptId): four placards in order
 * (definition, concept, application, recap), the language dial, term
 * details at every notch, and "Check this concept" at the end. The lesson
 * resumes at the saved placard and saves each move.
 */
export function LessonScreen() {
  const { conceptId = '' } = useParams()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [step, setStep] = useState(0)
  const [dial, setDial] = useDialLevel()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  useEffect(() => {
    let current = true
    setLoad({ status: 'loading' })
    const api = learningApi()
    api
      .getConceptLesson(conceptId)
      .then((lesson) =>
        Promise.all([api.getChapter(lesson.planId), api.getProgress(lesson.planId)]).then(([chapter, progress]) => {
          if (!current) return
          const saved = progress.concepts.find((c) => c.conceptId === conceptId)?.position?.placardId
          moved.current = false
          setStep(
            Math.max(
              0,
              lesson.placards.findIndex((p) => p.id === saved),
            ),
          )
          setLoad({ status: 'ready', lesson, chapter, progress })
        }),
      )
      .catch((error: unknown) => {
        if (!current) return
        setLoad({ status: error instanceof ServiceError && error.code === 'not_found' ? 'not_found' : 'error' })
      })
    return () => {
      current = false
    }
  }, [conceptId, attempt])

  // After Back or Next, move focus to the new placard so it's read out and in view
  useEffect(() => {
    if (moved.current) headingRef.current?.focus()
  }, [step])

  if (load.status === 'loading') return <LoadingState message="Loading the lesson…" />
  if (load.status === 'not_found') {
    return (
      <section>
        <h1>Concept not found</h1>
        <p>This concept isn't in your course. The chapter map shows every concept you can study.</p>
        <LinkButton to="/home" variant="secondary">
          Go to Home
        </LinkButton>
      </section>
    )
  }
  if (load.status === 'error') {
    return (
      <ErrorState
        message="Couldn't load this lesson. Check your connection."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    )
  }

  const { lesson, chapter, progress } = load
  const concept = chapter.concepts.find((c) => c.id === conceptId)
  const status = progress.concepts.find((c) => c.conceptId === conceptId)?.status
  const placards = lesson.placards
  const placard = placards[step]
  const last = step === placards.length - 1
  const mode = placardMode(dial)

  // This concept's own new terms (T-AM-08-* for C-AM-08); the rest were met in earlier concepts
  const ownPrefix = `${conceptId.replace(/^C-/, 'T-')}-`
  const newTerms = lesson.terms.filter((t) => t.id.startsWith(ownPrefix))
  const earlierTerms = lesson.terms.filter((t) => !t.id.startsWith(ownPrefix))
  const chipTerms = mode.chips === 'all' ? lesson.terms : newTerms

  // The key idea repeats the definition placard in this content; show it only when it adds something
  const showKeyIdea =
    shouldShowKeyIdea(lesson.keyIdea, dial) && lesson.keyIdea.en.trim() !== placards[0]?.body.en.trim()

  function goTo(index: number) {
    moved.current = true
    setStep(index)
    learningApi()
      .savePosition(conceptId, placards[index].id)
      .catch(() => {
        // Saving the place is best-effort; the lesson works without it
      })
  }

  const title = pick(placard.title, dial)
  const nextTitle = !last ? pick(placards[step + 1].title, dial) : null

  return (
    <div className={styles.screen}>
      <Link to={`/chapters/${lesson.planId}`} className={styles.back}>
        <ArrowBackIcon size={20} />
        {chapter.title.en}
      </Link>

      <header className={styles.header}>
        {concept && <p className={styles.eyebrow}>Concept {concept.order}</p>}
        <h1 className={styles.title}>{lesson.title.en}</h1>
        {!lacksOdia(lesson.title) && (
          <p className={styles.titleOr} lang="or">
            {lesson.title.or}
          </p>
        )}
        <div className={styles.badges}>
          {chapter.review.content === 'draft' && <StatusBadge label="Draft content" />}
          {status === 'passed' && <StatusBadge label="Check passed" tone="success" dimension="concept" />}
          {status === 'revisit' && <StatusBadge label="Revisit" tone="not_yet" />}
          {concept?.requiredForLab && <StatusBadge label="For the lab" dimension="lab" />}
        </div>
        <LanguageDial value={dial} onChange={setDial} />
      </header>

      {showKeyIdea && (
        <p className={styles.keyIdea}>
          <strong>Key idea: </strong>
          {lesson.keyIdea.en}
        </p>
      )}

      {/* From 768px: steps in a column on the left, the card held in place on the right */}
      <div className={styles.reader}>
        <nav aria-label="Lesson steps" className={styles.stepsNav}>
          <ol className={styles.steps}>
            {placards.map((p, i) => {
              const t = pick(p.title, dial)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={styles.step}
                    aria-current={i === step ? 'step' : undefined}
                    onClick={() => goTo(i)}
                  >
                    <span className={styles.stepNumber} aria-hidden="true">
                      {i + 1}
                    </span>
                    <span lang={t.lang}>{t.text}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className={styles.content}>
          <article className={styles.placard} aria-labelledby="placard-title">
            <p className={styles.stepOf}>
              Step {step + 1} of {placards.length}
            </p>
            <h2 id="placard-title" ref={headingRef} tabIndex={-1} lang={title.lang} className={styles.placardTitle}>
              {title.text}
            </h2>
            <PlacardText
              key={`${placard.id}-${mode.primary}`}
              text={placard.body[mode.primary]}
              lang={mode.primary}
              terms={chipTerms}
              showMeaning={mode.showMeaning}
              className={styles.body}
            />
            {mode.alsoEnglish && <PlacardText text={placard.body.en} lang="en" terms={[]} className={styles.english} />}
            {placard.sources.length > 0 && (
              <details className={styles.sources}>
                <summary>Sources ({placard.sources.length})</summary>
                <ul>
                  {placard.sources.map((s) => (
                    <li key={s.label}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.label}
                        </a>
                      ) : (
                        s.label
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              icon={<ArrowBackIcon size={20} />}
              disabled={step === 0}
              onClick={() => goTo(step - 1)}
            >
              Back
            </Button>
            {nextTitle ? (
              <Button icon={<ArrowForwardIcon size={20} />} onClick={() => goTo(step + 1)}>
                Next: <span lang={nextTitle.lang}>{nextTitle.text}</span>
              </Button>
            ) : (
              <LinkButton to={`/assessments/${lesson.assessmentId}/new`} icon={<ArrowForwardIcon size={20} />}>
                Check this concept
              </LinkButton>
            )}
          </div>
        </div>
      </div>

      <section className={styles.words} aria-labelledby="words-title">
        <h2 id="words-title" className={styles.wordsTitle}>
          Words in this lesson
        </h2>
        <p className={styles.wordsHint}>Tap a word for its Odia meaning, how to say it and an example.</p>
        <ul className={styles.wordList}>
          {newTerms.map((t) => (
            <li key={t.id}>
              <TermChip term={t} showMeaning={dial === 1} className={styles.listChip} />
            </li>
          ))}
        </ul>
        {earlierTerms.length > 0 && (
          <details className={styles.earlier}>
            <summary>Words from earlier concepts ({earlierTerms.length})</summary>
            <ul className={styles.wordList}>
              {earlierTerms.map((t) => (
                <li key={t.id}>
                  <TermChip term={t} className={styles.listChip} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  )
}
