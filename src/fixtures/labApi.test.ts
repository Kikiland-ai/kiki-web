import { describe, expect, it } from 'vitest'
import type { LabSession } from '../contracts'
import { createFixtureLabApi, LEASE_SECONDS } from './labApi'
import { createFixtureLearningApi } from './learningApi'
import { createFixtureStore, recordConceptCheck } from './store'

const PRACTICAL = 'PR-AM-DSB'
const LAPTOP = 'device-laptop'
const PHONE = 'device-phone'

function setup({ ready = true } = {}) {
  let clock = Date.parse('2026-10-16T10:00:00+05:30')
  const now = () => clock
  const store = createFixtureStore(null)
  if (ready) {
    recordConceptCheck(
      'C-AM-08',
      { runId: 'R-08', assessmentId: 'AS-AM-08', correct: 4, total: 5, completedAt: '2026-10-15T10:00:00+05:30' },
      store,
    )
  }
  return {
    api: createFixtureLabApi({ store, latencyMs: 0, now }),
    learning: createFixtureLearningApi({ store, latencyMs: 0, now }),
    advance: (seconds: number) => {
      clock += seconds * 1000
    },
  }
}

const base = (s: LabSession, deviceId = LAPTOP) => ({ deviceId, expectedRevision: s.revision })

/** Opens Simulink, confirms the workspace, grants capture and connects. */
async function connect(api: ReturnType<typeof setup>['api'], s: LabSession, deviceId = LAPTOP) {
  return api.updateConnection(s.id, {
    ...base(s, deviceId),
    software: { opened: true, workspaceConfirmed: true, projectSaved: true, projectRef: 'dsb_sc.slx' },
    connection: { state: 'active', consentGranted: true },
  })
}

describe('fixture LabApi', () => {
  it('starts in preparing while C-AM-08 is missing, with the pointer off and a reason', async () => {
    const { api } = setup({ ready: false })
    const s = await api.start(PRACTICAL, LAPTOP)
    expect(s.status).toBe('preparing')
    expect(s.readiness.missingConceptIds).toEqual(['C-AM-08'])
    expect(s.checkpoints).toHaveLength(12)
    expect(s.currentCheckpointId).toBe('CP-DSB-01')
    expect(s.pointer.active).toBe(false)
    expect(s.pointer.reasons).toContain('required_concepts_not_passed')
    expect(s.control).toMatchObject({ controllingDeviceId: LAPTOP, heartbeatSeconds: 10 })
  })

  it('returns the existing session instead of starting a second one', async () => {
    const { api } = setup()
    const a = await api.start(PRACTICAL, LAPTOP)
    const b = await api.start(PRACTICAL, LAPTOP)
    expect(b.id).toBe(a.id)
    expect((await api.getActive(PRACTICAL))?.id).toBe(a.id)
  })

  it('moves ready → connecting → active, and turns the pointer on only for the controlling device', async () => {
    const { api } = setup()
    let s = await api.start(PRACTICAL, LAPTOP)
    expect(s.status).toBe('ready')
    s = await api.updateConnection(s.id, { ...base(s), software: { opened: true } })
    expect(s.status).toBe('connecting')
    expect(s.pointer.reasons).toEqual(['workspace_not_confirmed', 'observation_not_enabled', 'connection_not_active', 'session_not_active'])
    s = await connect(api, s)
    expect(s.status).toBe('active')
    expect(s.pointer).toEqual({ active: true, reasons: [] })
    // Another device sees the same session, but the pointer isn't its to show
    const seen = await api.get(s.id)
    expect(seen.pointer.active).toBe(true)
  })

  it('rejects a change based on an old revision', async () => {
    const { api } = setup()
    const s = await api.start(PRACTICAL, LAPTOP)
    await connect(api, s)
    await expect(api.addObservation(s.id, { ...base(s), condition: 'Baseline', result: '100 Hz' })).rejects.toMatchObject({
      code: 'stale_revision',
    })
  })

  it('lets only the controlling device change the session', async () => {
    const { api } = setup()
    const s = await api.start(PRACTICAL, LAPTOP)
    await expect(api.updateConnection(s.id, { ...base(s, PHONE), software: { opened: true } })).rejects.toMatchObject({
      code: 'lease_held',
    })
  })

  it('renews the lease on heartbeat without changing the revision', async () => {
    const { api, advance } = setup()
    const s = await api.start(PRACTICAL, LAPTOP)
    advance(LEASE_SECONDS - 5)
    const beat = await api.heartbeat(s.id, base(s))
    expect(beat.revision).toBe(s.revision)
    expect(Date.parse(beat.control.leaseExpiresAt!)).toBeGreaterThan(Date.parse(s.control.leaseExpiresAt!))
  })

  it('drops to disconnected with the pointer off when the lease lapses', async () => {
    const { api, advance } = setup()
    let s = await api.start(PRACTICAL, LAPTOP)
    s = await connect(api, s)
    advance(LEASE_SECONDS + 1)
    const after = await api.get(s.id)
    expect(after.status).toBe('disconnected')
    expect(after.control.controllingDeviceId).toBeUndefined()
    expect(after.pointer.active).toBe(false)
    expect(after.pointer.reasons).toContain('no_controlling_device')
    await expect(api.heartbeat(s.id, base(after))).rejects.toMatchObject({ code: 'lease_expired' })
  })

  it('moves control to another device, which must reconnect Simulink and grant capture again', async () => {
    const { api } = setup()
    let s = await api.start(PRACTICAL, LAPTOP)
    s = await connect(api, s)
    const moved = await api.takeControl(s.id, base(s, PHONE))
    expect(moved.control.controllingDeviceId).toBe(PHONE)
    expect(moved.software).toMatchObject({ opened: false, workspaceConfirmed: false })
    expect(moved.connection).toEqual({ state: 'inactive', consentGranted: false })
    expect(moved.status).toBe('ready')
    // The old device is now an observer
    await expect(api.heartbeat(s.id, base(moved, LAPTOP))).rejects.toMatchObject({ code: 'lease_held' })
  })

  it('asks to save the open Simulink model before moving control', async () => {
    const { api } = setup()
    let s = await api.start(PRACTICAL, LAPTOP)
    s = await api.updateConnection(s.id, { ...base(s), software: { opened: true, projectSaved: false } })
    await expect(api.takeControl(s.id, base(s, PHONE))).rejects.toMatchObject({ code: 'needs_confirmation' })
  })

  it('accepts a copied link until it expires, and only for the revision it saved', async () => {
    const { api, advance } = setup()
    const s = await api.start(PRACTICAL, LAPTOP)
    const link = await api.createHandoff(s.id, base(s))
    expect(link.path).toBe(`/labs/${s.id}?handoff=${link.id}`)
    expect(link.savedRevision).toBe(s.revision)

    const moved = await api.takeControl(s.id, { ...base(s, PHONE), handoffId: link.id })
    expect(moved.control.controllingDeviceId).toBe(PHONE)

    const second = await api.createHandoff(s.id, base(moved, PHONE))
    advance(11 * 60)
    const current = await api.get(s.id)
    await expect(api.takeControl(s.id, { ...base(current, LAPTOP), handoffId: second.id })).rejects.toMatchObject({
      code: 'handoff_expired',
    })
  })

  it('treats a tick as self-report, and fills the lab ring only from verified evidence', async () => {
    const { api, learning } = setup()
    let s = await api.start(PRACTICAL, LAPTOP)
    s = await connect(api, s)
    s = await api.addEvidence(s.id, { ...base(s), checkpointId: 'CP-DSB-01', source: 'student_report', summary: 'Done' })
    expect(s.evidence[0].verdict).toBe('needs_review')
    expect(s.currentCheckpointId).toBe('CP-DSB-02')
    expect((await learning.getProgress('LP-ANALOG-MODULATION')).rings.lab).toEqual({ done: 0, total: 12 })

    s = await api.addEvidence(s.id, { ...base(s), checkpointId: 'CP-DSB-02', source: 'integration', summary: 'Blocks found' })
    expect(s.evidence[1].verdict).toBe('verified')
    expect((await learning.getProgress('LP-ANALOG-MODULATION')).rings.lab).toEqual({ done: 1, total: 12 })
  })

  it('records observations and finishes the session', async () => {
    const { api } = setup()
    let s = await api.start(PRACTICAL, LAPTOP)
    s = await connect(api, s)
    s = await api.addObservation(s.id, { ...base(s), condition: '90° fault', result: 'Message suppressed', receiverPhaseOffsetDeg: 90 })
    expect(s.observations[0]).toMatchObject({ receiverPhaseOffsetDeg: 90, source: 'student_report' })
    s = await api.finish(s.id, base(s))
    expect(s.status).toBe('completed')
    expect(s.pointer.active).toBe(false)
    expect(await api.getActive(PRACTICAL)).toBeNull()
    await expect(api.addObservation(s.id, { ...base(s), condition: 'x', result: 'y' })).rejects.toMatchObject({
      code: 'invalid_request',
    })
  })
})
