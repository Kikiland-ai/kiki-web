import { describe, expect, it } from 'vitest'
import { createPlaceSaver, type PlaceSaveState } from './placeSaver'

/** A save whose result the test decides, one call at a time. */
function harness() {
  const calls: { placeId: string; resolve: () => void; reject: (e: unknown) => void; signal: AbortSignal }[] = []
  const states: PlaceSaveState['status'][] = []
  const errors: unknown[] = []
  const saver = createPlaceSaver(
    (placeId, signal) => new Promise<void>((resolve, reject) => calls.push({ placeId, resolve, reject, signal })),
    (state) => {
      states.push(state.status)
      if (state.status === 'error') errors.push(state.error)
    },
  )
  const settle = () => new Promise((r) => setTimeout(r, 0))
  return { saver, calls, states, errors, settle }
}

describe('createPlaceSaver', () => {
  it('saves a place and reports saving, then saved', async () => {
    const { saver, calls, states, settle } = harness()
    saver.save('P1')
    expect(calls.map((c) => c.placeId)).toEqual(['P1'])
    calls[0].resolve()
    await settle()
    expect(states).toEqual(['saving', 'saved'])
  })

  it('runs one save at a time and sends only the latest place moved to meanwhile', async () => {
    const { saver, calls, states, settle } = harness()
    saver.save('P1')
    saver.save('P2')
    saver.save('P3')
    expect(calls.map((c) => c.placeId)).toEqual(['P1'])

    calls[0].resolve()
    await settle()
    expect(calls.map((c) => c.placeId)).toEqual(['P1', 'P3'])
    expect(states).toEqual(['saving', 'saving'])

    calls[1].resolve()
    await settle()
    expect(states.at(-1)).toBe('saved')
  })

  it('does not report a failure for a place the student has already left', async () => {
    const { saver, calls, states, errors, settle } = harness()
    saver.save('P1')
    saver.save('P2')
    calls[0].reject(new Error('offline'))
    await settle()
    expect(errors).toEqual([])
    expect(calls.at(-1)?.placeId).toBe('P2')

    calls[1].resolve()
    await settle()
    expect(states.at(-1)).toBe('saved')
  })

  it('reports a failure for the current place, and a retry saves it again', async () => {
    const { saver, calls, errors, states, settle } = harness()
    saver.save('P2')
    calls[0].reject(new Error('offline'))
    await settle()
    expect(states.at(-1)).toBe('error')
    expect(String(errors[0])).toContain('offline')

    saver.save('P2')
    calls[1].resolve()
    await settle()
    expect(states.at(-1)).toBe('saved')
  })

  it('moving away and back to the same place needs no second save', async () => {
    const { saver, calls, states, settle } = harness()
    saver.save('P1')
    saver.save('P2')
    saver.save('P1')
    calls[0].resolve()
    await settle()
    expect(calls).toHaveLength(1)
    expect(states.at(-1)).toBe('saved')
  })

  it('goes quiet once cancelled, e.g. when the lesson changes', async () => {
    const { saver, calls, states, settle } = harness()
    saver.save('P1')
    saver.save('P2')
    saver.cancel()
    expect(calls[0].signal.aborted).toBe(true)
    calls[0].resolve()
    await settle()
    expect(states).toEqual(['saving'])
    expect(calls).toHaveLength(1)
  })
})
