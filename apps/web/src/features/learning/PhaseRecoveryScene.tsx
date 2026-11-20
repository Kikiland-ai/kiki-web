import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PhaseRecoveryScene as Scene } from '../../contracts/concept-media'
import { describeFraction, passesBehaviorTests, recoveryFraction, tracePath } from './phase-math'
import type { NarrationCue } from './narrationCues'
import { useMediaQuery } from './useMediaQuery'
import styles from './PhaseRecoveryScene.module.css'

const fixed = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(2)
const EASE_MS = 600

type Props = {
  scene: Scene
  /** The narration cue in force, while a clip with hand-timed cues is open; null otherwise. */
  cue?: NarrationCue | null
  /**
   * 'stage': the narrated layout. The scene sits at the top of the step with the slim player,
   * follows the narration, and folds its controls away. 'full': the reading layout.
   */
  layout?: 'full' | 'stage'
  /** The slim narration bar shown at the top of the stage. */
  player?: ReactNode
}

/**
 * C-AM-08's own scene: how relative receiver phase error scales the ideal recovered message.
 * While narration with cues plays, the scene follows it; touching any control hands it back
 * to the student until they choose to follow again. Exploration never saves evidence,
 * changes lab settings or awards mastery.
 */
export function PhaseRecoveryScene({ scene, cue = null, layout = 'full', player }: Props) {
  const control = scene.controls[0]
  const [phi, setPhi] = useState(control.default)
  // What is drawn: eases toward phi when the narration moves it, jumps when the student does
  const [shown, setShown] = useState(control.default)
  const [following, setFollowing] = useState(true)
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const frame = useRef(0)
  const shownRef = useRef(shown)
  shownRef.current = shown

  const guided = Boolean(cue) && following
  const targetPhi = guided && cue?.phi !== undefined ? cue.phi : null

  // Follow the narration: move to the cue's angle (only when the cue names one)
  useEffect(() => {
    if (targetPhi === null) return
    setPhi(targetPhi)
    cancelAnimationFrame(frame.current)
    const from = shownRef.current
    if (reduceMotion || from === targetPhi) { setShown(targetPhi); return }
    const start = performance.now()
    // One clock for start and progress (a frame's own timestamp can use a different origin)
    const tick = () => {
      const t = Math.min(1, Math.max(0, (performance.now() - start) / EASE_MS))
      const eased = 1 - (1 - t) ** 3
      setShown(from + (targetPhi - from) * eased)
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [targetPhi, cue, reduceMotion])

  // A new clip starts in follow mode again
  const cueOpen = Boolean(cue)
  useEffect(() => { if (!cueOpen) setFollowing(true) }, [cueOpen])

  if (!passesBehaviorTests(scene)) return <p className={styles.note}>This interactive could not be checked against its lesson, so it is not shown.</p>

  function explore(next: number) {
    cancelAnimationFrame(frame.current)
    if (cue) setFollowing(false)
    setPhi(next)
    setShown(next)
  }

  const focus = guided ? cue?.focus : undefined
  const fraction = recoveryFraction(shown)
  const shownLabel = Math.round(shown)
  const unit = control.unit === 'degree' ? '°' : ''
  const on = (...names: string[]) => (focus && names.includes(focus) ? styles.cued : '')

  const trace = (
    <svg viewBox="0 0 320 120" className={`${styles.trace} ${on('aligned', 'half', 'null')}`} role="img" aria-label={`Recovered message at ${shownLabel} degree relative phase error: ${fixed(fraction)} of the aligned amplitude.`}>
      <line x1="0" x2="320" y1="60" y2="60" className={styles.zero} />
      <path d={tracePath(1)} className={styles.aligned} fill="none" data-testid="aligned-trace" />
      <path d={tracePath(fraction)} className={styles.recovered} fill="none" data-testid="recovered-trace" data-fraction={fixed(fraction)} />
    </svg>
  )
  const legend = (
    <ul className={styles.legend} aria-label="Legend">
      <li><span className={styles.swatchAligned} aria-hidden="true" />Aligned receiver, φ = 0{unit}</li>
      <li><span className={styles.swatchRecovered} aria-hidden="true" />Recovered, m(t) × cos φ</li>
    </ul>
  )
  const reading = (
    <p className={`${styles.reading} ${on('formula', 'half', 'null')}`}><span>{scene.outputs[0].label} · cos φ</span><output htmlFor="phase-error" data-testid="recovery-fraction">{fixed(fraction)}</output><span>{describeFraction(fraction)}</span></p>
  )
  const residualText = "These traces are ideal predictions. A real receiver's finite low-pass filter can leave high-frequency ripple, so an observed 90° trace need not be perfectly zero."
  const controls = (
    <div className={`${styles.controls} ${layout === 'full' ? on('control') : ''}`}>
      <label htmlFor="phase-error">{control.label} <strong>{phi}{unit}</strong></label>
      <input id="phase-error" type="range" min={control.min} max={control.max} step={control.step} value={phi} aria-valuetext={`${phi} degrees, recovery ${fixed(recoveryFraction(phi))}`} onChange={(e) => explore(Number(e.target.value))} />
      <div role="group" aria-label="Compare phase errors from the lesson" className={styles.presets}>
        {scene.comparisonDegrees.map((d) => (
          <button key={d} type="button" aria-pressed={phi === d} onClick={() => explore(d)}>
            {d}{unit}<small>cos = {fixed(recoveryFraction(d))}</small>
          </button>
        ))}
      </div>
      <button type="button" className={styles.reset} onClick={() => explore(control.default)}>Reset to lesson example</button>
    </div>
  )
  const residual = (
    <div role="note" className={`${styles.residual} ${on('residual')}`} aria-label="Finite-filter residual">
      <strong>Finite-filter residual · not modelled here</strong>
      <p>{residualText}</p>
    </div>
  )
  const note = <p className={styles.note}>Exploration only. This does not change your lab settings, saved lesson place or check results.</p>
  const sources = (
    <details className={styles.sources}>
      <summary>Scene sources · Draft teaching content, scientific review {scene.review.scientific}</summary>
      <ul>{scene.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>)}</ul>
    </details>
  )
  const follow = cue && (
    <div className={styles.follow} data-testid="narration-follow">
      {following ? (
        <>
          <p><span className={styles.live} aria-hidden="true" /><strong>Following the narration</strong><span className={styles.sep} aria-hidden="true">·</span><span>{cue.caption}</span></p>
          <button type="button" onClick={() => setFollowing(false)}>Explore on my own</button>
        </>
      ) : (
        <>
          <p><strong>You're exploring.</strong> The narration keeps playing but won't move the scene.</p>
          <button type="button" onClick={() => setFollowing(true)}>Follow the narration</button>
        </>
      )}
    </div>
  )

  if (layout === 'stage') {
    return (
      <section className={styles.stage} aria-label="Phase-recovery teaching scene" data-cue-focus={focus} data-narration-stage="">
        {player}
        <figure className={styles.stageFigure}>
          {trace}
          <figcaption className={styles.stagePanel}>
            <strong className={`${styles.stagePhi} ${on('control')}`}>φ = {shownLabel}{unit}</strong>
            {reading}
          </figcaption>
        </figure>
        {focus === 'residual' && <p className={`${styles.aside} ${styles.cued}`}>{residualText}</p>}
        {focus === 'frequency' && <p className={`${styles.aside} ${styles.cued}`}>Frequency mismatch is not drawn here: this scene keeps the frequencies equal.</p>}
        {follow}
        <details className={styles.explore}>
          <summary>Explore it yourself</summary>
          <div className={styles.exploreBody}>
            {legend}
            {controls}
            {residual}
            {note}
            {sources}
          </div>
        </details>
      </section>
    )
  }

  return (
    <section className={styles.scene} aria-label="Phase-recovery teaching scene" data-cue-focus={focus}>
      <header>
        <span className={styles.eyebrow}>SEE THE CONCEPT</span>
        <h2>How phase error scales the recovered message</h2>
        <p>{scene.prompt}</p>
      </header>
      {follow}
      <figure className={styles.figure}>
        <figcaption><strong>Recovered message at φ = {shownLabel}{unit}</strong><span>Two periods of a unit message · gain-corrected, frequency matched</span></figcaption>
        {trace}
        {legend}
        {reading}
        {focus === 'frequency' && <p className={`${styles.aside} ${styles.cued}`}>Frequency mismatch is not drawn here: this scene keeps the frequencies equal.</p>}
      </figure>
      {controls}
      {residual}
      {note}
      {sources}
    </section>
  )
}
