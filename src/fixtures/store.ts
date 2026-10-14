import type { Id, LabEvidence, LabObservation, LabSession, SessionHandoff, Timestamp } from '../contracts'

/** One concept-check result. Scores only: no questions, answers or responses. */
export interface ConceptCheckRecord {
  runId: Id
  assessmentId: Id
  attemptNumber: number
  correct: number
  total: number
  completedAt: Timestamp
}

/** A lab session as the fixture "server" keeps it; the API derives readiness and the pointer on read. */
export interface StoredLabSession {
  id: Id
  practicalId: Id
  status: LabSession['status']
  revision: number
  experimentSelected: boolean
  software: LabSession['software']
  connection: LabSession['connection']
  control: LabSession['control']
  /** The last device that held control, so a lapsed lease reads as lease_expired, not lease_held. */
  lastControllingDeviceId?: Id
  currentCheckpointId?: Id
  evidence: LabEvidence[]
  observations: LabObservation[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface FixtureState {
  version: 1
  conceptChecks: Record<Id, ConceptCheckRecord[]>
  positions: Record<Id, { placardId: Id; updatedAt: Timestamp }>
  labSessions: StoredLabSession[]
  handoffs: SessionHandoff[]
  nextId: number
}

const SEEDED_AT = '2026-10-12T12:30:00+05:30'

/**
 * The synthetic returning learner from the demo story (contract §3): concept
 * checks 01, 02, 03, 04, 06 and 07 passed, C-AM-08 next. Check 01 was failed
 * once first, so "latest run wins" is exercised.
 */
export function seedState(): FixtureState {
  const pass = (n: string): ConceptCheckRecord => ({
    runId: `FIXTURE-RUN-AM-${n}-PASS`,
    assessmentId: `AS-AM-${n}`,
    attemptNumber: n === '01' ? 2 : 1,
    correct: 4,
    total: 5,
    completedAt: SEEDED_AT,
  })
  return {
    version: 1,
    conceptChecks: {
      'C-AM-01': [
        {
          runId: 'FIXTURE-RUN-AM-01-FAIL',
          assessmentId: 'AS-AM-01',
          attemptNumber: 1,
          correct: 2,
          total: 5,
          completedAt: '2026-10-12T12:00:00+05:30',
        },
        pass('01'),
      ],
      'C-AM-02': [pass('02')],
      'C-AM-03': [pass('03')],
      'C-AM-04': [pass('04')],
      'C-AM-06': [pass('06')],
      'C-AM-07': [pass('07')],
    },
    positions: {},
    labSessions: [],
    handoffs: [],
    nextId: 1,
  }
}

export interface FixtureStore {
  read(): FixtureState
  /** Applies a change and saves it. */
  update<T>(change: (state: FixtureState) => T): T
  /** Back to the seeded learner, for demo rehearsals. */
  reset(): void
}

/**
 * In-memory state, saved to `storage` when given so a reload keeps the demo's
 * progress. Storage failures (private mode, blocked site data) are ignored.
 */
export function createFixtureStore(storage: Storage | null = null, key = 'kiki.fixture.v1'): FixtureStore {
  let state: FixtureState | null = null

  function load(): FixtureState {
    if (state) return state
    try {
      const saved = storage?.getItem(key)
      const parsed = saved ? (JSON.parse(saved) as FixtureState) : null
      state = parsed?.version === 1 ? parsed : seedState()
    } catch {
      state = seedState()
    }
    return state
  }

  function save() {
    try {
      storage?.setItem(key, JSON.stringify(state))
    } catch {
      // Keep working in memory
    }
  }

  return {
    read: () => structuredClone(load()),
    update(change) {
      const result = change(load())
      save()
      return result
    },
    reset() {
      state = seedState()
      save()
    },
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** The store the app's fixture adapters share. */
export const fixtureStore = createFixtureStore(browserStorage())

/**
 * Records a concept-check result, e.g. from the assessment fixture after a
 * submit, so progress and lab readiness update. Scores only, never answers.
 */
export function recordConceptCheck(
  conceptId: Id,
  result: Omit<ConceptCheckRecord, 'attemptNumber'>,
  store: FixtureStore = fixtureStore,
): void {
  store.update((s) => {
    const runs = (s.conceptChecks[conceptId] ??= [])
    runs.push({ ...result, attemptNumber: runs.length + 1 })
  })
}
