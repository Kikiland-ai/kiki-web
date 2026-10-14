import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import type { LabApi, LabSession } from '../../contracts'
import {
  createFixtureLabApi,
  createFixtureLearningApi,
  createFixtureStore,
  recordConceptCheck,
  type FixtureStore,
} from '../../fixtures'
import { setLearningApi } from '../learning/services'
import { LabHomeScreen } from './LabHomeScreen'
import { LabTrackerScreen } from './LabTrackerScreen'
import { deviceId, setLabApi } from './services'

let store: FixtureStore
let lab: LabApi

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: 'labs', element: <LabHomeScreen /> },
      { path: 'labs/:sessionId', element: <LabTrackerScreen /> },
      { path: 'concepts/:conceptId', element: <h1>Concept page</h1> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

function passC08() {
  recordConceptCheck(
    'C-AM-08',
    { runId: 'R-08', assessmentId: 'AS-AM-08', correct: 4, total: 5, completedAt: '2026-10-15T10:00:00+05:30' },
    store,
  )
}

const base = (s: LabSession, device = deviceId()) => ({ deviceId: device, expectedRevision: s.revision })

beforeEach(() => {
  window.localStorage.clear()
  store = createFixtureStore(null)
  lab = createFixtureLabApi({ store, latencyMs: 0 })
  setLabApi(lab)
  setLearningApi(createFixtureLearningApi({ store, latencyMs: 0 }))
})

afterEach(() => {
  cleanup()
  setLabApi(null)
  setLearningApi(null)
})

describe('Lab mode (/labs)', () => {
  it('lists the seven checks the lab needs, with C-AM-08 still to pass', async () => {
    renderAt('/labs')
    expect(await screen.findByRole('heading', { name: 'Lab mode', level: 1 })).toBeTruthy()
    expect(screen.getByText('1 to go')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Carrier mismatch and debugging/ }).getAttribute('href')).toBe('/concepts/C-AM-08')
    expect(screen.getByText(/1\. Amplitude, frequency and phase/).parentElement?.textContent).toContain('passed')
  })

  it('starts the experiment and opens the tracker', async () => {
    const router = renderAt('/labs')
    fireEvent.click(await screen.findByRole('button', { name: 'Start the experiment' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/labs/FIXTURE-LAB-1'))
  })

  it('offers Resume when a session exists', async () => {
    passC08()
    await lab.start('PR-AM-DSB', deviceId())
    renderAt('/labs')
    expect(await screen.findByRole('button', { name: 'Resume the lab' })).toBeTruthy()
    expect(screen.getByText('All 7 passed')).toBeTruthy()
    expect(screen.getByText('0 of 12 done')).toBeTruthy()
  })
})

describe('Lab tracker (/labs/:sessionId)', () => {
  it('while preparing: names the missing check, keeps steps readable, and blocks ticking', async () => {
    const s = await lab.start('PR-AM-DSB', deviceId())
    renderAt(`/labs/${s.id}`)
    expect(await screen.findByText('Preparing')).toBeTruthy()
    const prepare = screen.getByRole('region', { name: 'Before the guided steps' })
    await within(prepare).findByRole('link', { name: 'Carrier mismatch and debugging' })
    expect(screen.queryByRole('region', { name: 'Set up Simulink' })).toBeNull()
    expect(screen.getByText(/Guided steps open once the concept checks/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: "I've done this step" })).toBeNull()
    expect(screen.getByText('Manual guide')).toBeTruthy()
  })

  it('sets up Simulink, then saves a tick as self-reported and moves to the next step', async () => {
    passC08()
    const s = await lab.start('PR-AM-DSB', deviceId())
    renderAt(`/labs/${s.id}`)
    expect(await screen.findByText('Ready to connect')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: "I've opened it" }))
    fireEvent.click(await screen.findByRole('button', { name: 'This is my saved DSB-SC model' }))
    fireEvent.click(await screen.findByRole('button', { name: "I've done this step" }))

    expect(await screen.findByText('Step 1 saved.')).toBeTruthy()
    const steps = screen.getByRole('list', { name: 'DSB-SC steps' })
    const items = within(steps).getAllByRole('listitem')
    expect(within(items[0]).getByText('Your tick')).toBeTruthy()
    expect(items[1].getAttribute('aria-current')).toBe('step')
    expect(screen.getByText('1 of 12 steps done')).toBeTruthy()
    // Manual guide: set up and working, not stuck on "Connecting"
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.queryByText('Connecting')).toBeNull()
  })

  it("shows Kiki's pointer only while the server says it is active", async () => {
    passC08()
    const s = await lab.start('PR-AM-DSB', deviceId())
    let active = true
    // What the extension would make true: the server reports the pointer active
    const on = (x: LabSession): LabSession => (active ? { ...x, pointer: { active: true, reasons: [] } } : x)
    setLabApi({
      ...lab,
      get: async (id) => on(await lab.get(id)),
      heartbeat: async (id, r) => on(await lab.heartbeat(id, r)),
      updateConnection: async (id, u) => on(await lab.updateConnection(id, u)),
    })
    renderAt(`/labs/${s.id}`)

    expect(await screen.findByText('Kiki is pointing in Simulink. Follow the pointer there, or the written step below.')).toBeTruthy()
    expect(screen.getAllByText("Kiki's pointer on")).toHaveLength(2)
    expect(screen.queryByText('Manual guide')).toBeNull()
    expect(screen.queryByText("Why Kiki's pointer is off")).toBeNull()

    // The next read says it's off: the pointer goes at once and Manual guide is back
    active = false
    fireEvent.click(screen.getByRole('button', { name: "I've opened it" }))
    expect((await screen.findAllByText('Manual guide')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Kiki is pointing in Simulink/)).toBeNull()
    expect(screen.queryByText("Kiki's pointer on")).toBeNull()
    expect(screen.getByText("Why Kiki's pointer is off")).toBeTruthy()
  })

  it('never shows the pointer in Manual guide', async () => {
    passC08()
    const s = await lab.start('PR-AM-DSB', deviceId())
    renderAt(`/labs/${s.id}`)
    expect(await screen.findByText('Ready to connect')).toBeTruthy()
    expect(screen.getAllByText('Manual guide')).toHaveLength(2)
    expect(screen.queryByText("Kiki's pointer on")).toBeNull()
    expect(document.querySelector('svg[viewBox="0 0 80 80"]')).toBeNull()
  })

  it('shows "Running on another device" to an observer, who can take control', async () => {
    passC08()
    const s = await lab.start('PR-AM-DSB', 'other-device')
    renderAt(`/labs/${s.id}`)
    const observer = await screen.findByRole('region', { name: 'Running on another device' })
    expect(within(observer).getByText(/Now on step 1/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Set up Simulink' })).toBeNull()

    fireEvent.click(within(observer).getByRole('button', { name: 'Take control here' }))
    expect(await screen.findByText('This device is now running the lab.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Running on another device' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Set up Simulink' })).toBeTruthy()
  })

  it('takes control with a copied link', async () => {
    passC08()
    const s = await lab.start('PR-AM-DSB', 'other-device')
    const link = await lab.createHandoff(s.id, base(s, 'other-device'))
    renderAt(link.path)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue this lab here' }))
    expect(await screen.findByText('This device is now running the lab.')).toBeTruthy()
  })

  it('explains a change made on another device and shows the latest', async () => {
    passC08()
    const s = await lab.start('PR-AM-DSB', deviceId())
    renderAt(`/labs/${s.id}`)
    await screen.findByText('Ready to connect')
    // Meanwhile the same device's other tab moves the session on
    await lab.updateConnection(s.id, { ...base(s), software: { opened: true } })
    fireEvent.click(screen.getByRole('button', { name: "I've opened it" }))
    expect(await screen.findByText(/This lab changed on another device/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'This is my saved DSB-SC model' })).toBeTruthy()
  })

  it('saves observations', async () => {
    passC08()
    const s = await lab.start('PR-AM-DSB', deviceId())
    renderAt(`/labs/${s.id}`)
    await screen.findByText('Ready to connect')
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: '90° receiver phase' } })
    fireEvent.change(screen.getByLabelText('What you saw'), { target: { value: 'Recovered message nearly gone' } })
    fireEvent.change(screen.getByLabelText('Receiver phase in degrees (optional)'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }))
    expect(await screen.findByText('Observation saved.')).toBeTruthy()
    expect(screen.getByText('Recovered message nearly gone')).toBeTruthy()
    expect(screen.getByText('Receiver phase: 90°')).toBeTruthy()
  })

  it('makes a link for another device', async () => {
    passC08()
    const s = await lab.start('PR-AM-DSB', deviceId())
    renderAt(`/labs/${s.id}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Copy a link for another device' }))
    const input = (await screen.findByLabelText('Session link')) as HTMLInputElement
    expect(input.value).toMatch(new RegExp(`/labs/${s.id}\\?handoff=FIXTURE-HANDOFF-\\d+$`))
  })

  it('opens Finish only after all twelve steps, then shows the lab as finished', async () => {
    passC08()
    let s = await lab.start('PR-AM-DSB', deviceId())
    s = await lab.updateConnection(s.id, { ...base(s), software: { opened: true, workspaceConfirmed: true, projectSaved: true } })
    for (const c of s.checkpoints.slice(0, 11)) {
      s = await lab.addEvidence(s.id, { ...base(s), checkpointId: c.id, source: 'student_report', summary: 'tick' })
    }
    renderAt(`/labs/${s.id}`)
    const finish = (await screen.findByRole('button', { name: 'Finish the lab' })) as HTMLButtonElement
    expect(finish.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: "I've done this step" }))
    await screen.findByText('Step 12 saved.')
    expect((screen.getByRole('button', { name: 'Finish the lab' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Finish the lab' }))
    expect(await screen.findByText('Lab finished. Your work is saved.')).toBeTruthy()
    expect(screen.getByText('Finished')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save observation' })).toBeNull()
  })

  it('says plainly when the session is not found', async () => {
    renderAt('/labs/FIXTURE-LAB-99')
    expect(await screen.findByRole('heading', { name: 'Lab session not found' })).toBeTruthy()
  })
})
