import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

afterEach(cleanup)

describe('StatusBadge', () => {
  it('always shows its word', () => {
    render(<StatusBadge label="Draft" />)
    const badge = screen.getByText('Draft')
    expect(badge.className).toContain('neutral')
  })

  it('adds a tick for success', () => {
    render(<StatusBadge label="Passed" tone="success" />)
    const badge = screen.getByText('Passed')
    expect(badge.className).toContain('success')
    expect(badge.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  })

  it('marks not yet with its own class and no tick', () => {
    render(<StatusBadge label="Not yet" tone="not_yet" />)
    const badge = screen.getByText('Not yet')
    expect(badge.className).toContain('not_yet')
    expect(badge.querySelector('svg')).toBeNull()
  })

  it.each(['concept', 'words', 'english', 'lab'] as const)('tints for the %s dimension', (dimension) => {
    render(<StatusBadge label="Label" dimension={dimension} />)
    expect(screen.getByText('Label').className).toContain(dimension)
  })
})
