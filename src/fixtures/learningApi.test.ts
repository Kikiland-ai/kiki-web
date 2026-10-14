import { describe, expect, it } from 'vitest'
import { createFixtureLearningApi } from './learningApi'
import { createFixtureStore, recordConceptCheck } from './store'

function setup() {
  const store = createFixtureStore(null)
  return { store, api: createFixtureLearningApi({ store, latencyMs: 0 }) }
}

describe('fixture LearningApi', () => {
  it('returns the chapter, and not_found for another plan', async () => {
    const { api } = setup()
    expect((await api.getChapter('LP-ANALOG-MODULATION')).concepts).toHaveLength(10)
    await expect(api.getChapter('LP-NOPE')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('returns a lesson, and not_found for an unknown concept', async () => {
    const { api } = setup()
    const lesson = await api.getConceptLesson('C-AM-08')
    expect(lesson.assessmentId).toBe('AS-AM-08')
    expect(lesson.placards).toHaveLength(4)
    await expect(api.getConceptLesson('C-AM-99')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('shows the returning learner: six checks passed, C-AM-08 not started, lab not ready', async () => {
    const { api } = setup()
    const progress = await api.getProgress('LP-ANALOG-MODULATION')
    const status = Object.fromEntries(progress.concepts.map((c) => [c.conceptId, c.status]))
    expect(status).toEqual({
      'C-AM-01': 'passed',
      'C-AM-02': 'passed',
      'C-AM-03': 'passed',
      'C-AM-04': 'passed',
      'C-AM-05': 'not_started',
      'C-AM-06': 'passed',
      'C-AM-07': 'passed',
      'C-AM-08': 'not_started',
      'C-AM-09': 'not_started',
      'C-AM-10': 'not_started',
    })
    expect(progress.concepts[0].theoryCheck).toEqual({
      status: 'passed',
      latestRunId: 'FIXTURE-RUN-AM-01-PASS',
      attemptPercent: 80,
    })
    expect(progress.rings).toEqual({ concept: { done: 6, total: 10 }, words: null, english: null, lab: null })
    expect(progress.labReadiness).toMatchObject({ ready: false, missingConceptIds: ['C-AM-08'] })
  })

  it('saves the lesson position and marks the concept as learning', async () => {
    const { api } = setup()
    const saved = await api.savePosition('C-AM-08', 'CARD-AM-08-concept')
    expect(saved.status).toBe('learning')
    expect(saved.position?.placardId).toBe('CARD-AM-08-concept')
    const progress = await api.getProgress('LP-ANALOG-MODULATION')
    expect(progress.concepts.find((c) => c.conceptId === 'C-AM-08')?.position?.placardId).toBe('CARD-AM-08-concept')
    await expect(api.savePosition('C-AM-08', 'CARD-AM-01-definition')).rejects.toMatchObject({ code: 'invalid_request' })
  })

  it('flips lab readiness when the quiz fixture records a C-AM-08 pass, and shows revisit after a fail', async () => {
    const { api, store } = setup()
    const at = '2026-10-14T10:00:00+05:30'
    recordConceptCheck('C-AM-08', { runId: 'R1', assessmentId: 'AS-AM-08', correct: 2, total: 5, completedAt: at }, store)
    let progress = await api.getProgress('LP-ANALOG-MODULATION')
    expect(progress.concepts.find((c) => c.conceptId === 'C-AM-08')?.status).toBe('revisit')
    expect(progress.labReadiness?.ready).toBe(false)

    recordConceptCheck(
      'C-AM-08',
      { runId: 'R2', assessmentId: 'AS-AM-08', correct: 3, total: 5, completedAt: '2026-10-14T10:30:00+05:30' },
      store,
    )
    progress = await api.getProgress('LP-ANALOG-MODULATION')
    expect(progress.concepts.find((c) => c.conceptId === 'C-AM-08')?.status).toBe('passed')
    expect(progress.labReadiness).toMatchObject({ ready: true, missingConceptIds: [] })
    expect(progress.rings.concept).toEqual({ done: 7, total: 10 })
  })

  it('keeps state in storage across a reload, and resets to the seed', async () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
    } as unknown as Storage
    const first = createFixtureLearningApi({ store: createFixtureStore(storage), latencyMs: 0 })
    await first.savePosition('C-AM-08', 'CARD-AM-08-recap')

    const reloadedStore = createFixtureStore(storage)
    const reloaded = createFixtureLearningApi({ store: reloadedStore, latencyMs: 0 })
    let progress = await reloaded.getProgress('LP-ANALOG-MODULATION')
    expect(progress.concepts.find((c) => c.conceptId === 'C-AM-08')?.status).toBe('learning')

    reloadedStore.reset()
    progress = await reloaded.getProgress('LP-ANALOG-MODULATION')
    expect(progress.concepts.find((c) => c.conceptId === 'C-AM-08')?.status).toBe('not_started')
  })
})
