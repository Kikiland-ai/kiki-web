import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { appRoutes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(cleanup)

describe('app routes', () => {
  it('redirects / to Home', async () => {
    const router = renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/home')
  })

  it.each([
    ['/chapters/LP-ANALOG-MODULATION', 'Analog Modulation'],
    ['/concepts/C-AM-04', 'DSB-SC generation and sidebands'],
    ['/labs', 'Lab mode'],
    ['/labs/demo-session', 'DSB-SC lab'],
    ['/assessments/A-1/R-1', 'Quiz'],
  ])('renders %s inside the shell', async (path, heading) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Lab mode' })).toBeTruthy()
  })

  it('labels fixture data', async () => {
    renderAt('/home')
    expect(await screen.findByText(/Fixture mode/)).toBeTruthy()
  })

  it('serves the kit gallery in development', async () => {
    renderAt('/kit')
    expect(await screen.findByRole('heading', { name: 'Kit', level: 1 })).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Language mix' })).toBeTruthy()
  })

  it('shows a not-found page for unknown routes', async () => {
    renderAt('/nope')
    expect(await screen.findByRole('heading', { name: "This page doesn't exist" })).toBeTruthy()
  })
})
