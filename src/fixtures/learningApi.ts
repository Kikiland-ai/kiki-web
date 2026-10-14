import type { ChapterProgress, ConceptProgress, Id } from '../contracts'
import type { LearningApi } from '../contracts'
import { loadFixtureContent } from './content'
import { ServiceError } from './errors'
import { latestCheck, passes, requiredConceptReadiness } from './rules'
import { fixtureStore, type FixtureState, type FixtureStore } from './store'

export type FixtureOptions = {
  store?: FixtureStore
  /** Simulated network delay, so loading states show. Default 200ms; tests pass 0. */
  latencyMs?: number
  now?: () => number
}

export const wait = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve())

function conceptProgress(state: FixtureState, conceptId: Id): ConceptProgress {
  const latest = latestCheck(state.conceptChecks[conceptId])
  const position = state.positions[conceptId]
  const checkStatus = !latest ? 'not_attempted' : passes(latest.correct, latest.total) ? 'passed' : 'revisit'
  return {
    conceptId,
    status: checkStatus === 'passed' ? 'passed' : checkStatus === 'revisit' ? 'revisit' : position ? 'learning' : 'not_started',
    theoryCheck: {
      status: checkStatus,
      ...(latest && { latestRunId: latest.runId, attemptPercent: Math.round((latest.correct * 100) / latest.total) }),
    },
    ...(position && { position }),
  }
}

/**
 * LearningApi on labelled fixture data: the Analog Modulation content and the
 * synthetic learner in the fixture store. Progress is computed from stored
 * concept-check scores with the same rules as the backend.
 */
export function createFixtureLearningApi({
  store = fixtureStore,
  latencyMs = 200,
  now = Date.now,
}: FixtureOptions = {}): LearningApi {
  async function content() {
    await wait(latencyMs)
    return loadFixtureContent()
  }

  return {
    async getChapter(planId) {
      const { chapter } = await content()
      if (planId !== chapter.planId) throw new ServiceError('not_found', `No chapter ${planId} in fixture data.`)
      return structuredClone(chapter)
    },

    async getConceptLesson(conceptId) {
      const { lessons } = await content()
      const lesson = lessons[conceptId]
      if (!lesson) throw new ServiceError('not_found', `No lesson for ${conceptId} in fixture data.`)
      return structuredClone(lesson)
    },

    async getProgress(planId): Promise<ChapterProgress> {
      const { chapter, lab } = await content()
      if (planId !== chapter.planId) throw new ServiceError('not_found', `No chapter ${planId} in fixture data.`)
      const state = store.read()
      const concepts = chapter.concepts.map((c) => conceptProgress(state, c.id))
      const session = state.labSessions.find((s) => s.practicalId === lab.practicalId && s.status !== 'completed')
      const verified = new Set(
        session?.evidence.filter((e) => e.verdict === 'verified' && e.source !== 'student_report').map((e) => e.checkpointId),
      )
      return {
        planId,
        concepts,
        chapterTest: { status: 'not_attempted' },
        rings: {
          concept: { done: concepts.filter((c) => c.status === 'passed').length, total: concepts.length },
          // No words or English tasks in the fixture yet: not assessed, never 0%
          words: null,
          english: null,
          // Only verified checkpoints fill the lab ring (contract §8)
          lab: session ? { done: verified.size, total: lab.checkpoints.length } : null,
        },
        labReadiness: requiredConceptReadiness(lab.practicalId, lab.requiredConceptIds, state.conceptChecks),
      }
    },

    async savePosition(conceptId, placardId) {
      const { lessons } = await content()
      const lesson = lessons[conceptId]
      if (!lesson) throw new ServiceError('not_found', `No lesson for ${conceptId} in fixture data.`)
      if (!lesson.placards.some((p) => p.id === placardId)) {
        throw new ServiceError('invalid_request', `${placardId} is not a placard of ${conceptId}.`)
      }
      return store.update((s) => {
        s.positions[conceptId] = { placardId, updatedAt: new Date(now()).toISOString() }
        return conceptProgress(s, conceptId)
      })
    },
  }
}
