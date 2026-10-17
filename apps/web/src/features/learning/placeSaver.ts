export type PlaceSaveState = { status: 'saving' } | { status: 'saved' } | { status: 'error'; error: unknown }

/**
 * Saves the reading place without ever blocking reading. One save runs at a
 * time; moving again while it runs queues only the latest place, which is sent
 * when the running save ends. So an older place can never land after a newer
 * one, and a failure is shown only for the place the student is on.
 */
export function createPlaceSaver(
  save: (placeId: string, signal: AbortSignal) => Promise<unknown>,
  report: (state: PlaceSaveState) => void,
) {
  let running: AbortController | null = null
  let queued: string | null = null

  function start(placeId: string) {
    const operation = new AbortController()
    running = operation
    report({ status: 'saving' })
    save(placeId, operation.signal)
      .then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }))
      .then((outcome) => {
        if (operation.signal.aborted) return
        running = null
        const next = queued
        queued = null
        if (next !== null && next !== placeId) return start(next)
        report(outcome.ok ? { status: 'saved' } : { status: 'error', error: outcome.error })
      })
  }

  return {
    save(placeId: string) {
      if (running) queued = placeId
      else start(placeId)
    },
    /** Stops reporting, e.g. when the lesson changes or the screen closes. */
    cancel() {
      running?.abort()
      running = null
      queued = null
    },
  }
}
