import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import type { LearningApi } from '../../contracts'
import { createFixtureLearningApi, createFixtureStore, recordConceptCheck, type FixtureStore } from '../../fixtures'
import { ChapterMapScreen } from './ChapterMapScreen'
import { setLearningApi } from './services'

let store: FixtureStore

function renderAt(path = '/chapters/LP-ANALOG-MODULATION', api?: LearningApi) {
  setLearningApi(api ?? createFixtureLearningApi({ store, latencyMs: 0 }))
  const router = createMemoryRouter([{ path: 'chapters/:planId', element: <ChapterMapScreen /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

/** happy-dom has no layout; pick the phone or laptop branch of the map. */
function setWidth(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  store = createFixtureStore(null)
  setWidth(true)
})

afterEach(() => {
  cleanup()
  setLearningApi(null)
  vi.unstubAllGlobals()
})

describe('ChapterMapScreen', () => {
  it('shows the chapter as draft content, with progress and what to do next', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Analog Modulation', level: 1 })).toBeTruthy()
    expect(screen.getByText('Draft content')).toBeTruthy()
    expect(screen.getByText(/concept checks passed/).textContent).toBe('6 of 10 concept checks passed')
    const go = screen.getByRole('link', { name: 'Continue: Carrier mismatch and debugging' })
    expect(go.getAttribute('href')).toBe('/concepts/C-AM-08')
    expect(screen.getByRole('img', { name: /^This chapter: Concept 6 of 10, Words Not assessed/ })).toBeTruthy()
  })

  it('groups all ten concepts under the four sections and marks C-AM-08 up next', async () => {
    renderAt()
    await screen.findByRole('heading', { name: 'Analog Modulation', level: 1 })
    for (const title of ['Signal foundations', 'Amplitude modulation families', 'Detection and receiver diagnosis', 'Angle modulation']) {
      expect(screen.getByRole('heading', { name: title, level: 2 })).toBeTruthy()
    }
    const nodes = screen.getAllByRole('link', { name: /^Concept \d+:/ })
    expect(nodes).toHaveLength(10)
    const c08 = screen.getByRole('link', { name: /^Concept 8: Carrier mismatch and debugging/ })
    expect(within(c08).getByText('Up next')).toBeTruthy()
    expect(within(c08).getByText('Carrier mismatch ଓ Debugging')).toBeTruthy()
    expect(within(screen.getByRole('link', { name: /^Concept 7:/ })).getByText('Check passed')).toBeTruthy()
  })

  it('uses tiles from 600px and rows on phones', async () => {
    renderAt()
    expect((await screen.findAllByRole('link', { name: /^Concept \d+:/ }))[0].className).toContain('tile')
    cleanup()
    setWidth(false)
    renderAt()
    expect((await screen.findAllByRole('link', { name: /^Concept \d+:/ }))[0].className).toContain('row')
  })

  it('says which concept check the lab still needs, and offers preparation', async () => {
    renderAt()
    const lab = await screen.findByRole('region', { name: 'DSB-SC lab' })
    expect(within(lab).getByText(/Pass 1 more concept check/)).toBeTruthy()
    expect(within(lab).getByRole('link', { name: '8. Carrier mismatch and debugging' }).getAttribute('href')).toBe('/concepts/C-AM-08')
    expect(within(lab).getByRole('link', { name: 'Prepare for the lab' }).getAttribute('href')).toBe('/labs')
  })

  it('shows the lab as ready once C-AM-08 passes', async () => {
    recordConceptCheck('C-AM-08', { runId: 'r', assessmentId: 'AS-AM-08', correct: 3, total: 5, completedAt: '2026-10-15T10:00:00+05:30' }, store)
    renderAt()
    const lab = await screen.findByRole('region', { name: 'DSB-SC lab' })
    expect(within(lab).getByText('Ready')).toBeTruthy()
    expect(within(lab).getByRole('link', { name: 'Open the lab' }).getAttribute('href')).toBe('/labs')
  })

  it('links the chapter test', async () => {
    renderAt()
    const link = await screen.findByRole('link', { name: 'Take the chapter test' })
    expect(link.getAttribute('href')).toBe('/assessments/AS-AM-CHAPTER/new')
  })

  it('says plainly when the chapter is not found', async () => {
    renderAt('/chapters/LP-NOPE')
    expect(await screen.findByRole('heading', { name: 'Chapter not found' })).toBeTruthy()
  })

  it('offers Retry after a failure, and recovers', async () => {
    const real = createFixtureLearningApi({ store, latencyMs: 0 })
    let fail = true
    const flaky: LearningApi = {
      ...real,
      getChapter: (id) => (fail ? Promise.reject(new Error('offline')) : real.getChapter(id)),
    }
    renderAt(undefined, flaky)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain("Couldn't load this chapter")
    expect(alert.textContent).not.toContain('offline')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Analog Modulation', level: 1 })).toBeTruthy()
  })
})
