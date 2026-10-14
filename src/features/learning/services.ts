import { appMode } from '../../config/mode'
import type { LearningApi } from '../../contracts'
import { createFixtureLearningApi } from '../../fixtures'

/**
 * Stand-in until src/services (Akshita) chooses the adapter for VITE_APP_MODE.
 * Fixture mode gets the labelled fixture adapter; local and live fail with a
 * plain message, so nothing pretends to be live data. Replace with the shared
 * switch once it exists.
 */
let api: LearningApi | null = null

const notConnected: LearningApi = {
  getChapter: unavailable,
  getConceptLesson: unavailable,
  getProgress: unavailable,
  savePosition: unavailable,
}

async function unavailable(): Promise<never> {
  throw new Error("Lessons can't load yet: the app isn't connected to the Kiki API in this mode.")
}

export function learningApi(): LearningApi {
  api ??= appMode === 'fixture' ? createFixtureLearningApi() : notConnected
  return api
}

/** Tests swap in an adapter with no delay. */
export function setLearningApi(next: LearningApi | null): void {
  api = next
}
