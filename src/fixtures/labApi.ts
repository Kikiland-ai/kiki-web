import type { Id, LabApi, LabMutationBase, LabSession, SessionHandoff } from '../contracts'
import { loadFixtureContent, type FixtureContent } from './content'
import { ServiceError } from './errors'
import { type FixtureOptions, wait } from './learningApi'
import { pointerActivation, requiredConceptReadiness } from './rules'
import { fixtureStore, type FixtureState, type StoredLabSession } from './store'

/** Initial trial from contract §8: heartbeat every 10s, lease lasts 30s. */
export const HEARTBEAT_SECONDS = 10
export const LEASE_SECONDS = 30
export const HANDOFF_MINUTES = 10

/**
 * LabApi on labelled fixture data. It plays the server's part from contract
 * §8 in memory: revisions, the single-device control lease, copied links and
 * the pointer's activation rules. The fixture verifies integration evidence
 * itself; a student's tick stays self-report and never fills the lab ring.
 */
export function createFixtureLabApi({ store = fixtureStore, latencyMs = 200, now = Date.now }: FixtureOptions = {}): LabApi {
  const iso = (ms: number) => new Date(ms).toISOString()

  function readiness(state: FixtureState, lab: FixtureContent['lab']) {
    return requiredConceptReadiness(lab.practicalId, lab.requiredConceptIds, state.conceptChecks)
  }

  /** What a client sees: stored fields plus server-computed readiness and pointer. */
  function view(state: FixtureState, lab: FixtureContent['lab'], s: StoredLabSession, deviceId?: Id): LabSession {
    const ready = readiness(state, lab)
    return structuredClone({
      id: s.id,
      practicalId: s.practicalId,
      status: s.status,
      revision: s.revision,
      readiness: ready,
      software: s.software,
      connection: s.connection,
      control: s.control,
      pointer: pointerActivation(s, ready, deviceId, now()),
      ...(s.currentCheckpointId && { currentCheckpointId: s.currentCheckpointId }),
      checkpoints: lab.checkpoints,
      evidence: s.evidence,
      observations: s.observations,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })
  }

  /** The status the session's facts imply. Completed is final. */
  function settle(state: FixtureState, lab: FixtureContent['lab'], s: StoredLabSession) {
    if (s.status === 'completed') return
    if (!readiness(state, lab).ready) s.status = 'preparing'
    else if (!s.software.opened) s.status = 'ready'
    else if (s.connection.state === 'paused') s.status = 'paused'
    else if (s.connection.state === 'disconnected') s.status = 'disconnected'
    else if (s.software.workspaceConfirmed && s.connection.consentGranted && s.connection.state === 'active') {
      s.status = s.control.controllingDeviceId ? 'active' : 'disconnected'
    } else s.status = 'connecting'
  }

  /** A lapsed lease: the server drops control, turns the pointer off and marks the session disconnected. */
  function expireLease(s: StoredLabSession) {
    const expires = s.control.leaseExpiresAt
    if (!s.control.controllingDeviceId || !expires || Date.parse(expires) > now()) return false
    s.lastControllingDeviceId = s.control.controllingDeviceId
    s.control = { heartbeatSeconds: s.control.heartbeatSeconds }
    if (s.status !== 'completed' && s.software.opened) {
      s.status = 'disconnected'
      s.connection = { ...s.connection, state: 'disconnected' }
    }
    s.updatedAt = iso(now())
    return true
  }

  function grant(s: StoredLabSession, deviceId: Id) {
    s.control = { controllingDeviceId: deviceId, leaseExpiresAt: iso(now() + LEASE_SECONDS * 1000), heartbeatSeconds: HEARTBEAT_SECONDS }
    s.lastControllingDeviceId = deviceId
  }

  function find(state: FixtureState, sessionId: Id) {
    const s = state.labSessions.find((x) => x.id === sessionId)
    if (!s) throw new ServiceError('not_found', `No lab session ${sessionId}.`)
    expireLease(s)
    return s
  }

  function checkRevision(s: StoredLabSession, expected: number) {
    if (expected !== s.revision) {
      throw new ServiceError('stale_revision', 'This session changed on another device. Reload it and try again.')
    }
  }

  function checkControl(s: StoredLabSession, deviceId: Id) {
    if (s.control.controllingDeviceId === deviceId) return
    if (s.control.controllingDeviceId) throw new ServiceError('lease_held', 'Another device controls this session.')
    if (s.lastControllingDeviceId === deviceId) {
      throw new ServiceError('lease_expired', "This device's control lapsed. Take control again.")
    }
    throw new ServiceError('lease_held', 'This device does not control the session.')
  }

  function accept(s: StoredLabSession) {
    s.revision += 1
    s.updatedAt = iso(now())
  }

  /** Runs one server-side change against the stored state and returns the client's view. */
  async function mutate(
    sessionId: Id,
    request: LabMutationBase,
    change: (s: StoredLabSession, state: FixtureState, lab: FixtureContent['lab']) => void,
    { needsControl = true, bumpsRevision = true } = {},
  ): Promise<LabSession> {
    await wait(latencyMs)
    const { lab } = await loadFixtureContent()
    return store.update((state) => {
      const s = find(state, sessionId)
      if (s.status === 'completed') throw new ServiceError('invalid_request', 'This lab session is finished.')
      checkRevision(s, request.expectedRevision)
      if (needsControl) checkControl(s, request.deviceId)
      change(s, state, lab)
      settle(state, lab, s)
      if (bumpsRevision) accept(s)
      return view(state, lab, s, request.deviceId)
    })
  }

  return {
    async start(practicalId, deviceId) {
      await wait(latencyMs)
      const { lab } = await loadFixtureContent()
      if (practicalId !== lab.practicalId) throw new ServiceError('not_found', `No practical ${practicalId}.`)
      return store.update((state) => {
        const existing = state.labSessions.find((s) => s.practicalId === practicalId && s.status !== 'completed')
        if (existing) {
          expireLease(existing)
          return view(state, lab, existing, deviceId)
        }
        const at = iso(now())
        const s: StoredLabSession = {
          id: `FIXTURE-LAB-${state.nextId++}`,
          practicalId,
          status: 'preparing',
          revision: 1,
          // Starting from the DSB-SC card selects the experiment
          experimentSelected: true,
          software: { opened: false, workspaceConfirmed: false },
          connection: { state: 'inactive', consentGranted: false },
          control: { heartbeatSeconds: HEARTBEAT_SECONDS },
          currentCheckpointId: lab.checkpoints[0]?.id,
          evidence: [],
          observations: [],
          createdAt: at,
          updatedAt: at,
        }
        grant(s, deviceId)
        settle(state, lab, s)
        state.labSessions.push(s)
        return view(state, lab, s, deviceId)
      })
    },

    async getActive(practicalId) {
      await wait(latencyMs)
      const { lab } = await loadFixtureContent()
      return store.update((state) => {
        const s = state.labSessions.find((x) => x.practicalId === practicalId && x.status !== 'completed')
        if (!s) return null
        expireLease(s)
        return view(state, lab, s)
      })
    },

    async get(sessionId) {
      await wait(latencyMs)
      const { lab } = await loadFixtureContent()
      return store.update((state) => view(state, lab, find(state, sessionId)))
    },

    takeControl(sessionId, request) {
      return mutate(
        sessionId,
        request,
        (s, state) => {
          if (request.handoffId) {
            const handoff = state.handoffs.find((h) => h.id === request.handoffId && h.sessionId === sessionId)
            if (!handoff || Date.parse(handoff.expiresAt) <= now()) {
              throw new ServiceError('handoff_expired', 'This session link has expired. Open the lab from Home instead.')
            }
            if (handoff.savedRevision !== s.revision) {
              throw new ServiceError('stale_revision', 'The session changed after this link was made.')
            }
          }
          const from = s.control.controllingDeviceId
          if (from && from !== request.deviceId && s.software.opened && !s.software.projectSaved) {
            throw new ServiceError('needs_confirmation', 'Save the Simulink model on the other device first.')
          }
          if (from !== request.deviceId) {
            // The new device reopens Simulink and grants capture again; old permission is never reused
            s.software = { ...s.software, opened: false, workspaceConfirmed: false }
            s.connection = { state: 'inactive', consentGranted: false }
          }
          grant(s, request.deviceId)
        },
        { needsControl: false },
      )
    },

    heartbeat(sessionId, request) {
      // Renewing the lease isn't a change to the session, so the revision (and any copied link) stays valid
      return mutate(sessionId, request, (s) => grant(s, request.deviceId), { bumpsRevision: false })
    },

    release(sessionId, request) {
      return mutate(sessionId, request, (s) => {
        s.lastControllingDeviceId = undefined
        s.control = { heartbeatSeconds: s.control.heartbeatSeconds }
        if (s.connection.state === 'active') s.connection = { ...s.connection, state: 'disconnected' }
      })
    },

    async createHandoff(sessionId, request): Promise<SessionHandoff> {
      let handoff: SessionHandoff | undefined
      await mutate(
        sessionId,
        request,
        (s, state) => {
          handoff = {
            id: `FIXTURE-HANDOFF-${state.nextId++}`,
            sessionId,
            path: `/labs/${sessionId}?handoff=FIXTURE-HANDOFF-${state.nextId - 1}`,
            savedRevision: s.revision,
            expiresAt: iso(now() + HANDOFF_MINUTES * 60 * 1000),
          }
          state.handoffs.push(handoff)
        },
        { bumpsRevision: false },
      )
      return handoff!
    },

    updateConnection(sessionId, update) {
      return mutate(sessionId, update, (s) => {
        s.software = { ...s.software, ...update.software }
        s.connection = { ...s.connection, ...update.connection }
      })
    },

    addEvidence(sessionId, request) {
      return mutate(sessionId, request, (s, state, lab) => {
        const index = lab.checkpoints.findIndex((c) => c.id === request.checkpointId)
        if (index < 0) throw new ServiceError('invalid_request', `No checkpoint ${request.checkpointId}.`)
        s.evidence.push({
          id: `FIXTURE-EVIDENCE-${state.nextId++}`,
          checkpointId: request.checkpointId,
          source: request.source,
          // Only integration or screenshot review can verify; a tick is self-report
          verdict: request.source === 'student_report' ? 'needs_review' : 'verified',
          summary: request.summary,
          capturedAt: iso(now()),
        })
        if (s.currentCheckpointId === request.checkpointId) s.currentCheckpointId = lab.checkpoints[index + 1]?.id
      })
    },

    addObservation(sessionId, request) {
      return mutate(sessionId, request, (s, state) => {
        s.observations.push({
          id: `FIXTURE-OBSERVATION-${state.nextId++}`,
          condition: request.condition,
          result: request.result,
          ...(request.receiverPhaseOffsetDeg !== undefined && { receiverPhaseOffsetDeg: request.receiverPhaseOffsetDeg }),
          source: 'student_report',
          createdAt: iso(now()),
        })
      })
    },

    finish(sessionId, request) {
      return mutate(sessionId, request, (s) => {
        s.status = 'completed'
        s.control = { heartbeatSeconds: s.control.heartbeatSeconds }
        s.connection = { ...s.connection, state: 'inactive' }
      })
    },
  }
}
