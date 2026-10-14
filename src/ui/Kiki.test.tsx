import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Kiki, type KikiState } from './Kiki'

afterEach(cleanup)

const dots = (svg: Element) => Array.from(svg.querySelectorAll('rect'))

describe('Kiki', () => {
  it('is an image named after its state', () => {
    render(<Kiki state="thinking" />)
    const kiki = screen.getByRole('img', { name: 'Kiki is thinking' })
    expect(kiki.getAttribute('width')).toBe('64')
    expect(kiki.getAttribute('class')).toContain('thinking')
  })

  it('draws four dots in Google order: blue, red, yellow, green', () => {
    render(<Kiki state="idle" />)
    const fills = dots(screen.getByRole('img')).map((d) => d.style.fill)
    expect(fills).toEqual(['var(--blue)', 'var(--red)', 'var(--yellow)', 'var(--green)'])
  })

  it.each([
    ['lab', 0],
    ['words', 1],
    ['english', 2],
    ['concept', 3],
  ] as const)('grows the %s dot when it leads', (lead, index) => {
    render(<Kiki state="idle" lead={lead} />)
    const heights = dots(screen.getByRole('img')).map((d) => d.getAttribute('height'))
    heights.forEach((h, i) => expect(h).toBe(i === index ? '17' : '14'))
  })

  it.each([
    'idle',
    'listening',
    'thinking',
    'speaking',
    'pointing',
    'asking',
    'celebrating',
    'unsure',
    'examiner',
  ] as KikiState[])('renders the %s state', (state) => {
    render(<Kiki state={state} size={32} />)
    const kiki = screen.getByRole('img')
    expect(kiki.getAttribute('width')).toBe('32')
    expect(dots(kiki)).toHaveLength(4)
  })

  it('takes a custom label, or hides itself when the label is empty', () => {
    const { rerender, container } = render(<Kiki state="idle" label="Kiki, your guide" />)
    expect(screen.getByRole('img', { name: 'Kiki, your guide' })).toBeTruthy()
    rerender(<Kiki state="idle" label="" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
