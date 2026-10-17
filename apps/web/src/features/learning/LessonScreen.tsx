import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { ChapterProgress, ChapterView, ConceptLesson } from '../../contracts/api'
import { ServiceError, readableError } from '../../services/types'
import { useSession } from '../../app/Session'
import { Button, ErrorState, LanguageDial, LinkButton, LoadingState, StatusBadge, TermChip, type AudioPlayerHandle, type AudioSpeed } from '../../ui/learning'
import { ArrowBackIcon, ArrowForwardIcon, SpeakerIcon } from '../../ui/learning/icons'
import { checkManifestForLesson, findRendition, narrationLabel, type MediaManifest } from '../../contracts/concept-media'
import { lacksOdia, pick, placardMode, shouldShowKeyIdea } from './language'
import { PlacardText } from './PlacardText'
import { NarrationPlayer } from './NarrationPlayer'
import { createNarrationCache, type NarrationCache } from './narrationCache'
import { scenesFor } from './scenes'
import { createPlaceSaver } from './placeSaver'
import { useDialLevel } from './useDialLevel'
import styles from './LessonScreen.module.css'

type Load =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; lesson: ConceptLesson; chapter: ChapterView; progress: ChapterProgress }

type NarrationLang = 'or' | 'en'
// Published media for the lesson: absent media leaves the complete text lesson
type Media =
  | { status: 'none' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: MediaManifest; cache: NarrationCache }

/**
 * A concept lesson (/concepts/:conceptId): four placards in order
 * (definition, concept, application, recap), the language dial, term
 * details at every notch, and "Check this concept" at the end. The lesson
 * resumes at the saved placard and saves each move.
 */
export function LessonScreen() {
  const { conceptId = '' } = useParams()
  const { services, profile } = useSession()
  const uid = profile?.id
  const placeSaver = useRef<ReturnType<typeof createPlaceSaver> | null>(null)
  const [saveError, setSaveError] = useState(''), [savingPosition, setSavingPosition] = useState(false), [positionSaved, setPositionSaved] = useState(false)
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [step, setStep] = useState(0)
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null)
  const preference = useDialLevel()
  const { dial, setDial } = preference
  const headingRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  // Narration: opened only by Listen, closed by moving placard or changing the dial
  const [listening, setListening] = useState(false)
  const [speed, setSpeed] = useState<AudioSpeed>(1)
  const [narrationLang, setNarrationLang] = useState<NarrationLang | null>(null)
  const player = useRef<AudioPlayerHandle>(null)
  const [media, setMedia] = useState<Media>({ status: 'none' })
  const [mediaAttempt, setMediaAttempt] = useState(0)
  const mediaLesson = load.status === 'ready' ? load.lesson : null

  // Signing out stops the sound at once (contract: audio stops before the lease/session clean-up)
  useEffect(() => services.auth.registerSignOutCleanup(() => player.current?.pause()), [services])
  // A new dial notch can change the language on top of the card, so close the player
  useEffect(() => {
    setListening(false)
    setNarrationLang(null)
  }, [dial])

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    placeSaver.current?.cancel()
    setSavingPosition(false); setPositionSaved(false); setSaveError('')
    setListening(false); setNarrationLang(null)
    placeSaver.current = createPlaceSaver(
      (placardId, signal) => services.learning.savePosition(conceptId, placardId, signal),
      (state) => {
        setSavingPosition(state.status === 'saving')
        setPositionSaved(state.status === 'saved')
        setSaveError(state.status === 'error' ? readableError(state.error) : '')
      },
    )
    setLoad({ status: 'loading' }); setSelectedTermId(null)
    const api = services.learning
    api
      .getConceptLesson(conceptId, controller.signal)
      .then((lesson) =>
        Promise.all([api.getChapter(lesson.planId, controller.signal), api.getProgress(lesson.planId, controller.signal)]).then(([chapter, progress]) => {
          if (!current || controller.signal.aborted) return
          if (progress.ownerLearnerId !== uid) throw new ServiceError('The progress does not match your account.')
          const saved = progress.concepts.find((c) => c.conceptId === conceptId)?.position?.placardId
          moved.current = false
          setPositionSaved(Boolean(saved))
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
        setLoad({ message: readableError(error), status: error instanceof ServiceError && error.status === 404 && services.mode === 'fixture' ? 'not_found' : 'error' })
      })
    return () => {
      current = false
      controller.abort()
      placeSaver.current?.cancel()
    }
  }, [conceptId, attempt, services, uid])

  // Fetch the manifest the lesson points to; each clip is fetched only when Listen is pressed.
  // Leaving the lesson or signing out stops the sound and frees every loaded clip.
  useEffect(() => {
    const pointer = mediaLesson?.mediaExperience
    if (!mediaLesson || !pointer) { setMedia({ status: 'none' }); return }
    const controller = new AbortController()
    const cache = createNarrationCache((rendition, signal) => services.media.loadNarration(mediaLesson.conceptId, pointer.mediaRevision, rendition, signal))
    setMedia({ status: 'loading' })
    services.media
      .getManifest(mediaLesson.conceptId, controller.signal)
      .then((manifest) => { if (!controller.signal.aborted) setMedia({ status: 'ready', manifest: checkManifestForLesson(manifest, mediaLesson), cache }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setMedia({ status: 'error', message: error instanceof ServiceError ? error.message : 'The lesson media does not match this lesson.' }) })
    const unregister = services.auth.registerSignOutCleanup(() => { player.current?.pause(); cache.clear() })
    return () => { controller.abort(); cache.clear(); unregister() }
  }, [mediaLesson, services, mediaAttempt])

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
        message={load.message}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    )
  }

  const { lesson, chapter, progress } = load
  const concept = chapter.concepts.find((c) => c.id === conceptId)
  const missingPrerequisites = concept?.prerequisiteIds.filter(id => progress.concepts.find(c => c.conceptId === id)?.status !== 'passed') ?? []
  const status = progress.concepts.find((c) => c.conceptId === conceptId)?.status
  const placards = lesson.placards
  const placard = placards[step]
  const last = step === placards.length - 1
  const mode = placardMode(dial)
  // The audio reads the text on top of the card; at notch 3 (both shown) the player can switch to English
  const audioLang: NarrationLang = mode.alsoEnglish && narrationLang ? narrationLang : mode.primary
  const manifest = media.status === 'ready' ? media.manifest : null
  const clip = findRendition(manifest, placard.id, audioLang)
  const clipLanguages = mode.alsoEnglish
    ? (['or', 'en'] as const)
        .filter((l) => findRendition(manifest, placard.id, l))
        .map((l) => ({ value: l, label: l === 'or' ? 'Odia' : 'English' }))
    : undefined
  const openTerm = (id: string | null) => {
    if (id) player.current?.pause()
    setSelectedTermId(id)
  }

  // This concept's own new terms (T-AM-08-* for C-AM-08); the rest were met in earlier concepts
  const ownPrefix = `${conceptId.replace(/^C-/, 'T-')}-`
  const newTerms = lesson.terms.filter((t) => t.id.startsWith(ownPrefix))
  const earlierTerms = lesson.terms.filter((t) => !t.id.startsWith(ownPrefix))
  const chipTerms = mode.chips === 'all' ? lesson.terms : newTerms

  // The key idea repeats the definition placard in this content; show it only when it adds something
  const showKeyIdea =
    shouldShowKeyIdea(lesson.keyIdea, dial) && lesson.keyIdea.en.trim() !== placards[0]?.body.en.trim()

  // Reading never waits for a save: the place saver sends the latest place in the background
  function goTo(index: number) {
    if (!placards[index]) return
    moved.current = true
    setStep(index); setSaveError(''); setPositionSaved(false); setListening(false)
    placeSaver.current?.save(placards[index].id)
  }

  const title = pick(placard.title, dial)
  const nextTitle = !last ? pick(placards[step + 1].title, dial) : null

  return (
    <div className={`learning-scope ${styles.screen}`}>
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
        {preference.saving && <p role="status">Saving your language preference…</p>}
        {preference.error && <div role="alert">Language preference not saved: {preference.error} <Button variant="text" onClick={preference.retry}>Retry language preference</Button></div>}
      </header>

      {showKeyIdea && (
        <p className={styles.keyIdea}>
          <strong>Key idea: </strong>
          {lesson.keyIdea.en}
        </p>
      )}

      {missingPrerequisites.length > 0 && <aside aria-label="Prerequisite concepts" className="quiet-note"><div><strong>You can preview this lesson.</strong><p>Review these prerequisite concepts before progressing:</p><ul className={styles.prerequisites}>{missingPrerequisites.map(id => <li key={id}><Link to={`/concepts/${id}`}>{chapter.concepts.find(c => c.id === id)?.title.en ?? id}</Link></li>)}</ul></div></aside>}
      {savingPosition && <p role="status">Saving your place…</p>}
      {positionSaved && !savingPosition && !saveError && <p role="status">{services.mode === 'fixture' ? 'Place saved in this browser' : 'Place saved'}</p>}
      {saveError && <div role="alert">Your place was not saved. {saveError} <Button variant="text" onClick={() => goTo(step)}>Retry saving place</Button></div>}
      {services.mode === 'fixture' && <p className="helper-note">Sample lesson · places save in this browser after confirmation. Reading does not pass a concept check.</p>}
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
            {clip && !listening && (
              <Button variant="secondary" icon={<SpeakerIcon size={20} />} onClick={() => setListening(true)} className={styles.listen}>
                Listen
              </Button>
            )}
            {clip && listening && media.status === 'ready' && (
              <NarrationPlayer
                key={`audio-${placard.id}-${audioLang}`}
                ref={player}
                cache={media.cache}
                rendition={clip}
                title={title.text}
                label={narrationLabel(clip, media.manifest.release)}
                detail="Plays this whole step. Words are not highlighted: the clip has no sentence timing yet."
                speed={speed}
                onSpeedChange={setSpeed}
                languages={clipLanguages}
                language={audioLang}
                onLanguageChange={(l) => setNarrationLang(l as NarrationLang)}
                onClose={() => setListening(false)}
                autoPlay
              />
            )}
            <PlacardText
              key={`${placard.id}-${mode.primary}`}
              text={placard.body[mode.primary]}
              lang={mode.primary}
              terms={chipTerms}
              showMeaning={mode.showMeaning}
              onTermOpen={openTerm}
              className={styles.body}
            />
            {mode.alsoEnglish && <PlacardText text={placard.body.en} lang="en" terms={[]} className={styles.english} />}
            {media.status === 'error' && (
              <p className="helper-note">
                Audio and interactives for this lesson are unavailable: {media.message} The text is complete.{' '}
                <Button variant="text" onClick={() => setMediaAttempt((n) => n + 1)}>Retry lesson media</Button>
              </p>
            )}
            {scenesFor(lesson, manifest, placard, { terms: lesson.terms, selectedTermId, onTermOpen: openTerm }).map((slot) => (
              <Fragment key={slot.key}>{slot.node}</Fragment>
            ))}
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
              <TermChip term={t} onOpen={openTerm} showMeaning={dial === 1} className={styles.listChip} />
            </li>
          ))}
        </ul>
        {earlierTerms.length > 0 && (
          <details className={styles.earlier}>
            <summary>Words from earlier concepts ({earlierTerms.length})</summary>
            <ul className={styles.wordList}>
              {earlierTerms.map((t) => (
                <li key={t.id}>
                  <TermChip term={t} onOpen={openTerm} className={styles.listChip} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  )
}
