import { describe, expect, it } from 'vitest'
import { createFixtureLearningApi, createFixtureStore, recordConceptCheck } from '../../fixtures'
import { nextConceptId } from './nextConcept'

async function next(setup?: (store: ReturnType<typeof createFixtureStore>) => Promise<void> | void) {
  const store = createFixtureStore(null)
  const api = createFixtureLearningApi({ store, latencyMs: 0 })
  await setup?.(store)
  const plan = 'LP-ANALOG-MODULATION'
  return nextConceptId(await api.getChapter(plan), await api.getProgress(plan))
}

const at = (h: number) => `2026-10-14T${String(h).padStart(2, '0')}:00:00+05:30`

describe('nextConceptId', () => {
  it('is C-AM-08 for the returning learner: the last lab concept, its prerequisite passed', async () => {
    expect(await next()).toBe('C-AM-08')
  })

  it('prefers a concept the student has started', async () => {
    expect(
      await next(async (store) => {
        await createFixtureLearningApi({ store, latencyMs: 0 }).savePosition('C-AM-09', 'CARD-AM-09-concept')
      }),
    ).toBe('C-AM-09')
  })

  it('prefers revisiting a failed lab concept over everything else', async () => {
    expect(
      await next(async (store) => {
        await createFixtureLearningApi({ store, latencyMs: 0 }).savePosition('C-AM-09', 'CARD-AM-09-concept')
        recordConceptCheck('C-AM-03', { runId: 'r', assessmentId: 'AS-AM-03', correct: 1, total: 5, completedAt: at(15) }, store)
      }),
    ).toBe('C-AM-03')
  })

  it('moves on to the first unpassed concept once the lab concepts pass', async () => {
    expect(
      await next((store) =>
        recordConceptCheck('C-AM-08', { runId: 'r', assessmentId: 'AS-AM-08', correct: 3, total: 5, completedAt: at(15) }, store),
      ),
    ).toBe('C-AM-05')
  })
})
