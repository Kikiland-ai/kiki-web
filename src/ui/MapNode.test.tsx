import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MapNode, type MapNodeProps } from './MapNode'

afterEach(cleanup)

const base: MapNodeProps = {
  to: '/concepts/C-AM-08',
  order: 8,
  title: 'Carrier mismatch and debugging',
  status: 'not_started',
}

function renderNode(props: Partial<MapNodeProps> = {}) {
  return render(
    <MemoryRouter>
      <MapNode {...base} {...props} />
    </MemoryRouter>,
  )
}

describe('MapNode', () => {
  it('links to the concept, named by its number and title', () => {
    renderNode({ titleOr: 'Carrier mismatch ଓ Debugging' })
    const link = screen.getByRole('link', { name: /Concept 8: Carrier mismatch and debugging/ })
    expect(link.getAttribute('href')).toBe('/concepts/C-AM-08')
    expect(within(link).getByText('Carrier mismatch ଓ Debugging').getAttribute('lang')).toBe('or')
  })

  it.each([
    ['learning', 'Learning'],
    ['revisit', 'Revisit'],
    ['passed', 'Check passed'],
  ] as const)('writes the %s status as a word', (status, word) => {
    renderNode({ status })
    expect(screen.getByText(word)).toBeTruthy()
    expect(screen.getByRole('link').className).toContain(status)
  })

  it('still names "Not started" for screen readers', () => {
    renderNode({ status: 'not_started' })
    expect(screen.getByRole('link', { name: /Not started/ })).toBeTruthy()
  })

  it('marks the next concept and lab concepts in words', () => {
    renderNode({ next: true, requiredForLab: true })
    expect(screen.getByText('Up next')).toBeTruthy()
    expect(screen.getByText('For the lab')).toBeTruthy()
  })

  it('is named by the concept, with mastery as its description ("Not assessed", never 0%)', () => {
    renderNode({ rings: { concept: { done: 5, total: 5 } }, next: true })
    const link = screen.getByRole('link', { name: /^Concept 8: Carrier mismatch and debugging/ })
    expect(screen.getByRole('link').getAttribute('aria-label')).toBeNull()
    const description = document.getElementById(link.getAttribute('aria-describedby')!)
    expect(description?.textContent).toBe(
      'Mastery: Concept 5 of 5, Words Not assessed, English Not assessed, Lab Not assessed',
    )
    // The ring, LED and Kiki pin repeat what the text says, so they're hidden from screen readers
    expect(screen.queryByRole('img')).toBeNull()
  })

  it.each(['tile', 'row'] as const)('renders the %s layout', (layout) => {
    renderNode({ layout })
    expect(screen.getByRole('link').className).toContain(layout)
  })
})
