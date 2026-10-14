import { beforeEach, describe, expect, it } from 'vitest'
import { createFixtureStore, recordConceptCheck, type FixtureState } from './store'

const KEY = 'kiki.fixture.v1'
const saved = () => JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as FixtureState

/** What the browser does in every other tab after one tab saves. */
function otherTabSaved(key: string | null = KEY) {
  window.dispatchEvent(new StorageEvent('storage', { key, storageArea: window.localStorage }))
}

const pass08 = {
  runId: 'R-08',
  assessmentId: 'AS-AM-08',
  correct: 4,
  total: 5,
  completedAt: '2026-10-13T10:00:00+05:30',
}

beforeEach(() => window.localStorage.clear())

describe('fixture store across tabs', () => {
  it("keeps another tab's passed check when this tab writes next", () => {
    const tracker = createFixtureStore(window.localStorage) // e.g. a lab tracker left open
    tracker.read()
    const kit = createFixtureStore(window.localStorage) // e.g. /kit in another tab
    recordConceptCheck('C-AM-08', pass08, kit)
    otherTabSaved()

    tracker.update((s) => {
      s.nextId += 1 // any write, like a heartbeat
    })

    expect(saved().conceptChecks['C-AM-08']).toHaveLength(1)
    expect(saved().nextId).toBe(2)
  })

  it("keeps another tab's reset instead of writing old progress back", () => {
    const tracker = createFixtureStore(window.localStorage)
    recordConceptCheck('C-AM-08', pass08, tracker)
    const kit = createFixtureStore(window.localStorage)
    kit.reset()
    otherTabSaved()

    tracker.update((s) => {
      s.nextId += 1
    })

    expect(saved().conceptChecks['C-AM-08']).toBeUndefined()
    expect(tracker.read().conceptChecks['C-AM-08']).toBeUndefined()
  })

  it('reloads when another tab clears all storage', () => {
    const tracker = createFixtureStore(window.localStorage)
    recordConceptCheck('C-AM-08', pass08, tracker)
    window.localStorage.clear()
    otherTabSaved(null)
    expect(tracker.read().conceptChecks['C-AM-08']).toBeUndefined()
  })

  it('ignores saves to other keys', () => {
    const tracker = createFixtureStore(window.localStorage)
    recordConceptCheck('C-AM-08', pass08, tracker)
    window.localStorage.setItem('kiki.dialLevel', '4')
    otherTabSaved('kiki.dialLevel')
    expect(tracker.read().conceptChecks['C-AM-08']).toHaveLength(1)
  })

  it('works in memory with no storage, as tests use it', () => {
    const store = createFixtureStore(null)
    recordConceptCheck('C-AM-08', pass08, store)
    otherTabSaved()
    expect(store.read().conceptChecks['C-AM-08']).toHaveLength(1)
  })
})
