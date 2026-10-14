import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import type { LearningApi } from '../../contracts'
import { createFixtureLearningApi, createFixtureStore, recordConceptCheck, type FixtureStore } from '../../fixtures'
import { setLearningApi } from '../learning/services'
import { DemoLearnerPanel } from './DemoLearnerPanel'

let store: FixtureStore

function renderPanel(api?: LearningApi) {
  setLearningApi(api ?? createFixtureLearningApi({ store, latencyMs: 0 }))
  const router = createMemoryRouter([{ path: '/', element: <DemoLearnerPanel store={store} /> }])
  render(<RouterProvider router={router} />)
}

const markButton = () => screen.getByRole('button', { name: 'Mark C-AM-08 passed' }) as HTMLButtonElement

beforeEach(() => {
  store = createFixtureStore(null)
})

afterEach(() => {
  cleanup()
  setLearningApi(null)
})

describe('DemoLearnerPanel', () => {
  it('shows the seeded learner: C-AM-08 not taken, lab waiting on it', async () => {
    renderPanel()
    expect(await screen.findByText('Not taken yet')).toBeTruthy()
    expect(screen.getByText('Needs C-AM-08')).toBeTruthy()
    expect(markButton().disabled).toBe(false)
    expect(screen.getByRole('link', { name: 'Chapter map' }).getAttribute('href')).toBe('/chapters/LP-ANALOG-MODULATION')
    expect(screen.getByRole('link', { name: 'Lab mode' }).getAttribute('href')).toBe('/labs')
  })

  it('passes C-AM-08 with a score only, which makes the lab ready', async () => {
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Mark C-AM-08 passed' }))

    expect(await screen.findByText('Passed (80%)')).toBeTruthy()
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('C-AM-08 marked passed with 4 of 5.')
    expect(markButton().disabled).toBe(true)

    const runs = store.read().conceptChecks['C-AM-08']
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ assessmentId: 'AS-AM-08', attemptNumber: 1, correct: 4, total: 5 })
    expect(Object.keys(runs[0]).sort()).toEqual(['assessmentId', 'attemptNumber', 'completedAt', 'correct', 'runId', 'total'])
  })

  it('adds a passing run after a failed one, so the latest run wins', async () => {
    recordConceptCheck(
      'C-AM-08',
      { runId: 'R-FAIL', assessmentId: 'AS-AM-08', correct: 2, total: 5, completedAt: '2026-10-13T10:00:00+05:30' },
      store,
    )
    renderPanel()
    expect(await screen.findByText('Not yet (40%)')).toBeTruthy()

    fireEvent.click(markButton())
    expect(await screen.findByText('Passed (80%)')).toBeTruthy()
    expect(store.read().conceptChecks['C-AM-08'].map((r) => r.attemptNumber)).toEqual([1, 2])
  })

  it('resets to the seeded learner, clearing lesson position and lab sessions', async () => {
    store.update((s) => {
      s.positions['C-AM-08'] = { placardId: 'P-2', updatedAt: '2026-10-15T10:00:00+05:30' }
    })
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Mark C-AM-08 passed' }))
    await screen.findByText('Passed (80%)')

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo learner' }))
    expect(await screen.findByText('Not taken yet')).toBeTruthy()
    expect(screen.getByText('Needs C-AM-08')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/^Demo learner reset/)
    expect(store.read().conceptChecks['C-AM-08']).toBeUndefined()
    expect(store.read().positions).toEqual({})
  })

  it('offers a retry when progress fails to load', async () => {
    const api = createFixtureLearningApi({ store, latencyMs: 0 })
    let fail = true
    renderPanel({ ...api, getProgress: (planId) => (fail ? Promise.reject(new Error('offline')) : api.getProgress(planId)) })

    expect(await screen.findByText("Couldn't load the demo learner.")).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Not taken yet')).toBeTruthy()
  })
})
