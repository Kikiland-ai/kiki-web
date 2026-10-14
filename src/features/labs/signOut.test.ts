import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LabApi } from '../../contracts'
import { createFixtureLabApi, createFixtureStore, recordConceptCheck, type FixtureStore } from '../../fixtures'
import { deviceId, setLabApi } from './services'
import { releaseLabOnSignOut } from './signOut'

let store: FixtureStore
let lab: LabApi

beforeEach(() => {
  window.localStorage.clear()
  store = createFixtureStore(null)
  lab = createFixtureLabApi({ store, latencyMs: 0 })
  setLabApi(lab)
  recordConceptCheck(
    'C-AM-08',
    { runId: 'R-08', assessmentId: 'AS-AM-08', correct: 4, total: 5, completedAt: '2026-10-13T10:00:00+05:30' },
    store,
  )
})

afterEach(() => setLabApi(null))

describe('releaseLabOnSignOut', () => {
  it('releases the session this device controls, so another device can take over at once', async () => {
    const s = await lab.start('PR-AM-DSB', deviceId())
    expect(s.control.controllingDeviceId).toBe(deviceId())

    await releaseLabOnSignOut()

    const after = await lab.get(s.id)
    expect(after.control.controllingDeviceId).toBeUndefined()
    await expect(lab.takeControl(s.id, { deviceId: 'other-device', expectedRevision: after.revision })).resolves.toBeTruthy()
  })

  it("leaves another device's session alone", async () => {
    const s = await lab.start('PR-AM-DSB', 'other-device')
    await releaseLabOnSignOut()
    expect((await lab.get(s.id)).control.controllingDeviceId).toBe('other-device')
  })

  it('does nothing when there is no lab session', async () => {
    await expect(releaseLabOnSignOut()).resolves.toBeUndefined()
    expect(await lab.getActive('PR-AM-DSB')).toBeNull()
  })

  it('never throws, so a failed release cannot block sign-out', async () => {
    await lab.start('PR-AM-DSB', deviceId())
    setLabApi({ ...lab, release: () => Promise.reject(new Error('offline')) })
    await expect(releaseLabOnSignOut()).resolves.toBeUndefined()

    setLabApi({ ...lab, getActive: () => Promise.reject(new Error('offline')) })
    await expect(releaseLabOnSignOut()).resolves.toBeUndefined()
  })
})
