import type { PhaseRecoveryScene } from '../../contracts/concept-media'

/** Known analytic model only: ideal gain-corrected coherent recovery scales m(t) by cos(phi). */
export function recoveryFraction(phiDegrees: number) {
  if (!Number.isFinite(phiDegrees)) throw new Error('Use a finite phase error in degrees.')
  const value = Math.cos((phiDegrees * Math.PI) / 180)
  return Math.abs(value) < 1e-12 ? 0 : value
}

/** The renderer must reproduce the manifest's own expected values before it may draw. */
export function passesBehaviorTests(scene: PhaseRecoveryScene) {
  const control = scene.controls[0].name, output = scene.outputs[0].name
  return scene.behaviorTests.every((t) => t.output === output && Object.keys(t.inputs).length === 1 && Number.isFinite(t.inputs[control]) && Math.abs(recoveryFraction(t.inputs[control]) - t.expected) <= t.tolerance)
}

/** Two periods of a unit, zero-mean message and its recovered copy, as SVG path data. */
export function tracePath(scale: number, width = 320, height = 120, points = 241) {
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1)
    const y = height / 2 - scale * Math.sin(4 * Math.PI * t) * (height / 2 - 8)
    return `${i === 0 ? 'M' : 'L'}${(t * width).toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}

export function describeFraction(fraction: number) {
  if (fraction === 1) return 'Fully recovered: the receiver carrier is aligned.'
  if (fraction === 0) return 'The ideal message component is suppressed.'
  if (fraction === -1) return 'Full amplitude, but with inverted sign.'
  const percent = Math.round(Math.abs(fraction) * 100)
  return fraction > 0 ? `Reduced to ${percent}% of the aligned amplitude.` : `Inverted, at ${percent}% of the aligned amplitude.`
}
