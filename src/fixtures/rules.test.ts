import { describe, expect, it } from 'vitest'
import { latestCheck, passes, requiredConceptReadiness } from './rules'
import { seedState, type ConceptCheckRecord } from './store'

const REQUIRED = ['C-AM-01', 'C-AM-02', 'C-AM-03', 'C-AM-04', 'C-AM-06', 'C-AM-07', 'C-AM-08']

const run = (over: Partial<ConceptCheckRecord>): ConceptCheckRecord => ({
  runId: 'R',
  assessmentId: 'AS-AM-08',
  attemptNumber: 1,
  correct: 3,
  total: 5,
  completedAt: '2026-10-14T10:00:00+05:30',
  ...over,
})

describe('fixture rules (ported from learning-case.js)', () => {
  it.each([
    [2, 5, 60, false],
    [3, 5, 60, true],
    [7, 10, 80, false],
    [8, 10, 80, true],
  ])('%i/%i at %i%% passes: %s', (correct, total, pass, expected) => {
    expect(passes(correct, total, pass)).toBe(expected)
  })

  it('never passes an empty run', () => {
    expect(passes(0, 0)).toBe(false)
  })

  it('takes the latest run, then the higher attempt on a tie', () => {
    const early = run({ runId: 'early', correct: 5, completedAt: '2026-10-14T09:00:00+05:30' })
    const late = run({ runId: 'late', correct: 1 })
    expect(latestCheck([late, early])?.runId).toBe('late')
    const tieA = run({ runId: 'a', attemptNumber: 1 })
    const tieB = run({ runId: 'b', attemptNumber: 2 })
    expect(latestCheck([tieB, tieA])?.runId).toBe('b')
  })

  it('reports the seeded learner as missing C-AM-08 only', () => {
    const r = requiredConceptReadiness('PR-AM-DSB', REQUIRED, seedState().conceptChecks)
    expect(r.ready).toBe(false)
    expect(r.missingConceptIds).toEqual(['C-AM-08'])
    expect(r.evidenceRunIds).toHaveLength(6)
    expect(r.evidenceRunIds).toContain('FIXTURE-RUN-AM-01-PASS')
    expect(r.chapterTestRequired).toBe(false)
  })

  it('is ready once C-AM-08 passes at 3/5, and not after a later 2/5', () => {
    const checks = seedState().conceptChecks
    checks['C-AM-08'] = [run({ runId: 'pass' })]
    expect(requiredConceptReadiness('PR-AM-DSB', REQUIRED, checks).ready).toBe(true)
    checks['C-AM-08'].push(run({ runId: 'fail', correct: 2, attemptNumber: 2, completedAt: '2026-10-14T11:00:00+05:30' }))
    const after = requiredConceptReadiness('PR-AM-DSB', REQUIRED, checks)
    expect(after.ready).toBe(false)
    expect(after.missingConceptIds).toEqual(['C-AM-08'])
  })
})
