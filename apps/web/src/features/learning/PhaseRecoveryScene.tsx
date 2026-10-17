import { useState } from 'react'
import type { PhaseRecoveryScene as Scene } from '../../contracts/concept-media'
import { describeFraction, passesBehaviorTests, recoveryFraction, tracePath } from './phase-math'
import styles from './PhaseRecoveryScene.module.css'

const fixed = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(2)

/**
 * C-AM-08's own scene: how relative receiver phase error scales the ideal recovered message.
 * Exploration is local; it never saves evidence, changes lab settings or awards mastery.
 */
export function PhaseRecoveryScene({ scene }: { scene: Scene }) {
  const control = scene.controls[0]
  const [phi, setPhi] = useState(control.default)
  if (!passesBehaviorTests(scene)) return <p className={styles.note}>This interactive could not be checked against its lesson, so it is not shown.</p>
  const fraction = recoveryFraction(phi)
  const unit = control.unit === 'degree' ? '°' : ''
  return (
    <section className={styles.scene} aria-label="Phase-recovery teaching scene">
      <header>
        <span className={styles.eyebrow}>SEE THE CONCEPT</span>
        <h2>How phase error scales the recovered message</h2>
        <p>{scene.prompt}</p>
      </header>
      <figure className={styles.figure}>
        <figcaption><strong>Recovered message at φ = {phi}{unit}</strong><span>Two periods of a unit message · gain-corrected, frequency matched</span></figcaption>
        <svg viewBox="0 0 320 120" className={styles.trace} role="img" aria-label={`Recovered message at ${phi} degree relative phase error: ${fixed(fraction)} of the aligned amplitude.`}>
          <line x1="0" x2="320" y1="60" y2="60" className={styles.zero} />
          <path d={tracePath(1)} className={styles.aligned} fill="none" data-testid="aligned-trace" />
          <path d={tracePath(fraction)} className={styles.recovered} fill="none" data-testid="recovered-trace" data-fraction={fixed(fraction)} />
        </svg>
        <ul className={styles.legend} aria-label="Legend">
          <li><span className={styles.swatchAligned} aria-hidden="true" />Aligned receiver, φ = 0{unit}</li>
          <li><span className={styles.swatchRecovered} aria-hidden="true" />Recovered, m(t) × cos φ</li>
        </ul>
        <p className={styles.reading}><span>{scene.outputs[0].label} · cos φ</span><output htmlFor="phase-error" data-testid="recovery-fraction">{fixed(fraction)}</output><span>{describeFraction(fraction)}</span></p>
      </figure>
      <div className={styles.controls}>
        <label htmlFor="phase-error">{control.label} <strong>{phi}{unit}</strong></label>
        <input id="phase-error" type="range" min={control.min} max={control.max} step={control.step} value={phi} aria-valuetext={`${phi} degrees, recovery ${fixed(fraction)}`} onChange={(e) => setPhi(Number(e.target.value))} />
        <div role="group" aria-label="Compare phase errors from the lesson" className={styles.presets}>
          {scene.comparisonDegrees.map((d) => (
            <button key={d} type="button" aria-pressed={phi === d} onClick={() => setPhi(d)}>
              {d}{unit}<small>cos = {fixed(recoveryFraction(d))}</small>
            </button>
          ))}
        </div>
        <button type="button" className={styles.reset} onClick={() => setPhi(control.default)}>Reset to lesson example</button>
      </div>
      <div role="note" className={styles.residual} aria-label="Finite-filter residual">
        <strong>Finite-filter residual · not modelled here</strong>
        <p>These traces are ideal predictions. A real receiver's finite low-pass filter can leave high-frequency ripple, so an observed 90° trace need not be perfectly zero.</p>
      </div>
      <p className={styles.note}>Exploration only. This does not change your lab settings, saved lesson place or check results.</p>
      <details className={styles.sources}>
        <summary>Scene sources · Draft teaching content, scientific review {scene.review.scientific}</summary>
        <ul>{scene.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>)}</ul>
      </details>
    </section>
  )
}
