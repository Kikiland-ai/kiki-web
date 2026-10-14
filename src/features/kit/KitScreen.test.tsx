import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { createFixtureLearningApi, createFixtureStore } from '../../fixtures'
import { setLearningApi } from '../learning/services'
import { KitScreen } from './KitScreen'

afterEach(() => {
  cleanup()
  setLearningApi(null)
})

describe('KitScreen', () => {
  it('names every section after its heading, including multi-word titles', async () => {
    setLearningApi(createFixtureLearningApi({ store: createFixtureStore(null), latencyMs: 0 }))
    render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <KitScreen /> }])} />)
    await screen.findByText('Not taken yet')

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toContain('Demo learner')
    for (const title of headings) {
      expect(screen.getByRole('region', { name: title ?? '' })).toBeTruthy()
    }
  })
})
