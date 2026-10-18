import { describe, expect, it } from 'vitest'
import preview from '../../fixtures/concept-media-C-AM-08.json'
import { PhaseRecoverySceneSchema, MediaManifestSchema } from '../../contracts/concept-media'
import { describeFraction, passesBehaviorTests, recoveryFraction, tracePath } from './phase-math'

const scene = PhaseRecoverySceneSchema.parse(MediaManifestSchema.parse(preview.manifest).artifacts[0])

describe('phase-recovery model', () => {
  it('scales ideal recovery by cos(phi), as the lesson states', () => {
    expect(recoveryFraction(0)).toBe(1)
    expect(recoveryFraction(60)).toBeCloseTo(0.5, 12)
    expect(recoveryFraction(90)).toBe(0)
    expect(recoveryFraction(180)).toBe(-1)
    expect(() => recoveryFraction(Number.NaN)).toThrow()
    expect(describeFraction(recoveryFraction(60))).toBe('Reduced to 50% of the aligned amplitude.')
    expect(describeFraction(0)).toBe('The ideal message component is suppressed.')
    expect(describeFraction(recoveryFraction(120))).toBe('Inverted, at 50% of the aligned amplitude.')
  })

  it("reproduces the manifest's own behaviour tests, and refuses a scene it cannot reproduce", () => {
    expect(passesBehaviorTests(scene)).toBe(true)
    expect(passesBehaviorTests({ ...scene, behaviorTests: [{ inputs: { phi: 60 }, output: 'fraction', expected: 0.6, tolerance: 1e-6 }] })).toBe(false)
    expect(passesBehaviorTests({ ...scene, behaviorTests: [{ inputs: { theta: 60 }, output: 'fraction', expected: 0.5, tolerance: 1e-6 }] })).toBe(false)
  })

  it('draws the recovered trace at the predicted amplitude and flat at 90 degrees', () => {
    const peak = (path: string) => Math.max(...path.split(' ').map(p => Math.abs(60 - Number(p.split(',')[1]))))
    expect(peak(tracePath(1))).toBeCloseTo(52, 1)
    expect(peak(tracePath(recoveryFraction(60)))).toBeCloseTo(26, 1)
    expect(peak(tracePath(recoveryFraction(90)))).toBe(0)
  })
})
