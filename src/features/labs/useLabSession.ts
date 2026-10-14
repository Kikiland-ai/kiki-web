import { useCallback, useEffect, useRef, useState } from 'react'
import type { Id, LabMutationBase, LabSession } from '../../contracts'
import { ServiceError } from '../../fixtures'
import { deviceId, labApi } from './services'

export type LabSessionState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error' }
  | { status: 'ready'; session: LabSession }

/** What went wrong, in plain words, with what to do next. No codes. */
export function explainFailure(error: unknown): string {
  if (!(error instanceof ServiceError)) return "That didn't save. Check your connection and try again."
  switch (error.code) {
    case 'stale_revision':
      return 'This lab changed on another device. You are seeing the latest now; try again.'
    case 'lease_held':
      return 'Another device is running this lab. Take control here to carry on on this device.'
    case 'lease_expired':
      return "This device's control lapsed. Take control here to carry on."
    case 'handoff_expired':
      return 'That session link has expired. Open the lab from Lab mode instead.'
    case 'needs_confirmation':
      return 'Save your Simulink model on the other device first, then try again.'
    case 'not_found':
      return "This lab session doesn't exist any more."
    default:
      return "That didn't save. Check your connection and try again."
  }
}

/**
 * One lab session for this device: loads it, runs changes with this device's
 * id and the revision it last saw, and renews the control lease while this
 * device holds it. A refused change reloads the latest session and says why.
 */
export function useLabSession(sessionId: Id) {
  const [state, setState] = useState<LabSessionState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const me = deviceId()
  const latest = useRef<LabSession | null>(null)

  const show = useCallback((session: LabSession) => {
    latest.current = session
    setState({ status: 'ready', session })
  }, [])

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    labApi()
      .get(sessionId)
      .then((session) => current && show(session))
      .catch((error: unknown) => {
        if (!current) return
        setState({ status: error instanceof ServiceError && error.code === 'not_found' ? 'not_found' : 'error' })
      })
    return () => {
      current = false
    }
  }, [sessionId, attempt, show])

  const reload = useCallback(async () => {
    const fresh = await labApi()
      .get(sessionId)
      .catch(() => null)
    if (fresh) show(fresh)
  }, [sessionId, show])

  /** Runs one change against the session; on refusal, shows the latest session and the reason. */
  const act = useCallback(
    async (change: (session: LabSession, base: LabMutationBase) => Promise<LabSession>, success?: string) => {
      const session = latest.current
      if (!session) return
      setBusy(true)
      setNotice(null)
      try {
        show(await change(session, { deviceId: me, expectedRevision: session.revision }))
        if (success) setNotice(success)
      } catch (error) {
        await reload()
        setNotice(explainFailure(error))
      } finally {
        setBusy(false)
      }
    },
    [me, reload, show],
  )

  // Heartbeat while this device controls the session (contract §8)
  const session = state.status === 'ready' ? state.session : null
  const controlling = !!session && session.control.controllingDeviceId === me && session.status !== 'completed'
  const heartbeatMs = (session?.control.heartbeatSeconds ?? 10) * 1000
  useEffect(() => {
    if (!controlling) return
    const timer = window.setInterval(() => {
      const s = latest.current
      if (!s) return
      labApi()
        .heartbeat(sessionId, { deviceId: me, expectedRevision: s.revision })
        .then(show)
        .catch(async (error: unknown) => {
          await reload()
          setNotice(explainFailure(error))
        })
    }, heartbeatMs)
    return () => window.clearInterval(timer)
  }, [controlling, heartbeatMs, me, reload, sessionId, show])

  return { state, notice, setNotice, busy, act, me, retry: () => setAttempt((n) => n + 1) }
}
