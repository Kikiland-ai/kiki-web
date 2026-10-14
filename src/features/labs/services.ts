import { appMode } from '../../config/mode'
import type { LabApi } from '../../contracts'
import { createFixtureLabApi } from '../../fixtures'

/**
 * Stand-in until src/services (Akshita) chooses the adapter for VITE_APP_MODE.
 * Fixture mode gets the labelled fixture adapter; local and live fail with a
 * plain message, so nothing pretends to be a live lab session.
 */
let api: LabApi | null = null

async function unavailable(): Promise<never> {
  throw new Error("The lab can't load yet: the app isn't connected to the Kiki API in this mode.")
}

const notConnected: LabApi = {
  start: unavailable,
  getActive: unavailable,
  get: unavailable,
  takeControl: unavailable,
  heartbeat: unavailable,
  release: unavailable,
  createHandoff: unavailable,
  updateConnection: unavailable,
  addEvidence: unavailable,
  addObservation: unavailable,
  finish: unavailable,
}

export function labApi(): LabApi {
  api ??= appMode === 'fixture' ? createFixtureLabApi() : notConnected
  return api
}

/** Tests swap in an adapter with no delay. */
export function setLabApi(next: LabApi | null): void {
  api = next
}

const DEVICE_KEY = 'kiki.deviceId'
let memoryDeviceId: string | null = null

/** A random id per browser (contract §2), kept in localStorage as kiki.deviceId. */
export function deviceId(): string {
  try {
    const saved = window.localStorage.getItem(DEVICE_KEY)
    if (saved) return saved
    const id = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    memoryDeviceId ??= crypto.randomUUID()
    return memoryDeviceId
  }
}
