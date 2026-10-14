import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MasteryRing } from './MasteryRing'

afterEach(cleanup)

describe('MasteryRing', () => {
  it('reads "Not assessed" for missing and null values, never 0%', () => {
    render(<MasteryRing label="C-AM-08" values={{ words: null }} />)
    const ring = screen.getByRole('img')
    expect(ring.getAttribute('aria-label')).toBe(
      'C-AM-08: Concept Not assessed, Words Not assessed, English Not assessed, Lab Not assessed',
    )
    expect(ring.getAttribute('aria-label')).not.toMatch(/0%|0 of/)
  })

  it('reads coverage as "done of total", and 0 of 3 differs from not assessed', () => {
    render(<MasteryRing values={{ concept: { done: 3, total: 5 }, words: { done: 0, total: 3 } }} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Concept 3 of 5, Words 0 of 3, English Not assessed, Lab Not assessed',
    )
  })

  it('draws unassessed segments dashed and assessed ones as track plus fill', () => {
    const { container } = render(<MasteryRing values={{ concept: { done: 3, total: 5 }, words: { done: 0, total: 3 } }} />)
    expect(container.querySelectorAll('circle.unassessed')).toHaveLength(2)
    expect(container.querySelectorAll('circle.track')).toHaveLength(2)
    // Words is 0 of 3: a track with no fill
    expect(container.querySelectorAll('circle.fill')).toHaveLength(1)
    expect(container.querySelector('circle.fill')?.getAttribute('class')).toContain('concept')
  })

  it('treats a zero total as not assessed', () => {
    render(<MasteryRing values={{ lab: { done: 0, total: 0 } }} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Lab Not assessed')
  })

  it('says "Not assessed" in the centre of a large empty ring', () => {
    const { rerender } = render(<MasteryRing size={96} values={{}} />)
    expect(screen.getByText('Not assessed')).toBeTruthy()
    rerender(<MasteryRing size={44} values={{}} />)
    expect(screen.queryByText('Not assessed')).toBeNull()
  })

  it('writes out a legend when asked', () => {
    render(<MasteryRing values={{ concept: { done: 1, total: 5 } }} showLegend />)
    expect(screen.getByText('Concept: 1 of 5')).toBeTruthy()
    expect(screen.getByText('Lab: Not assessed')).toBeTruthy()
  })
})
