import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { KikiPointer, KIKI_POINTER_TIP, type KikiPointerState } from './KikiPointer'

afterEach(cleanup)

const dots = (svg: Element) => Array.from(svg.querySelectorAll('rect.dot, rect[class*="dot"]'))

describe('KikiPointer', () => {
  it('is an image named after its state, 48px by default', () => {
    render(<KikiPointer state="pointing" />)
    const pointer = screen.getByRole('img', { name: 'Kiki is pointing here' })
    expect(pointer.getAttribute('width')).toBe('48')
    expect(pointer.getAttribute('viewBox')).toBe('0 0 80 80')
    expect(pointer.getAttribute('class')).toContain('pointing')
  })

  it('draws a dark cursor with two eyes and four dots in Google order', () => {
    render(<KikiPointer state="idle" />)
    const pointer = screen.getByRole('img')
    expect(pointer.querySelector('path[class*="cursor"]')?.getAttribute('d')).toMatch(/^M12 8 /)
    expect(pointer.querySelectorAll('g[class*="eyes"] circle')).toHaveLength(2)
    expect(dots(pointer).map((d) => (d as SVGElement).style.fill)).toEqual([
      'var(--blue)',
      'var(--red)',
      'var(--yellow)',
      'var(--green)',
    ])
  })

  it.each([
    ['lab', 0],
    ['words', 1],
    ['english', 2],
    ['concept', 3],
  ] as const)('grows the %s dot and colours the wait ring with it', (lead, index) => {
    render(<KikiPointer state="waiting" lead={lead} />)
    const pointer = screen.getByRole('img', { name: 'Kiki is waiting for you here' })
    const sizes = dots(pointer).map((d) => d.getAttribute('width'))
    sizes.forEach((w, i) => expect(w).toBe(i === index ? '8.4' : '6.4'))
    const ring = pointer.querySelector('circle[class*="waitRing"]') as SVGElement
    expect(ring.style.stroke).toBe(['var(--blue)', 'var(--red)', 'var(--yellow)', 'var(--green)'][index])
    expect(ring.getAttribute('cx')).toBe('12')
    expect(ring.getAttribute('cy')).toBe('8')
  })

  it('marks each state with its own pose', () => {
    const { rerender } = render(<KikiPointer state="tapping" />)
    const pointer = () => screen.getByRole('img')
    expect(pointer().querySelector('circle[class*="ripple"]')).toBeTruthy()

    rerender(<KikiPointer state="asking" />)
    expect(pointer().querySelector('text')?.textContent).toBe('?')

    rerender(<KikiPointer state="dragging" />)
    expect(pointer().querySelector('rect[class*="ghost"]')).toBeTruthy()

    rerender(<KikiPointer state="thinking" />)
    expect(pointer().querySelector('g[class*="orbit"]')?.querySelectorAll('rect')).toHaveLength(4)

    rerender(<KikiPointer state="celebrating" />)
    expect(pointer().querySelector('g[class*="happyEyes"]')?.querySelectorAll('path')).toHaveLength(2)
    expect(pointer().querySelector('g[class*="eyes"] circle')).toBeNull()

    rerender(<KikiPointer state="unsure" />)
    expect(pointer().querySelector('g[class*="look"]')).toBeTruthy()
  })

  it.each([
    'idle',
    'pointing',
    'tapping',
    'dragging',
    'tracing',
    'thinking',
    'asking',
    'listening',
    'celebrating',
    'unsure',
    'waiting',
  ] as KikiPointerState[])('renders %s with four dots and a plain-language name', (state) => {
    render(<KikiPointer state={state} />)
    const pointer = screen.getByRole('img')
    expect(pointer.getAttribute('aria-label')).toMatch(/^Kiki/)
    expect(dots(pointer)).toHaveLength(4)
  })

  it('takes a custom name, or hides itself when visible text says the same', () => {
    const { rerender, container } = render(<KikiPointer state="tapping" label="Kiki says: tap Run" />)
    expect(screen.getByRole('img', { name: 'Kiki says: tap Run' })).toBeTruthy()
    rerender(<KikiPointer state="tapping" label="" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('mirrors when flipped and accepts placement styles', () => {
    render(<KikiPointer state="pointing" flip size={56} style={{ left: 10, top: 20 }} />)
    const pointer = screen.getByRole('img')
    expect(pointer.getAttribute('class')).toContain('flip')
    expect(pointer.getAttribute('width')).toBe('56')
    expect((pointer as unknown as SVGElement).style.left).toBe('10px')
  })

  it('exposes the tip position so callers can land it on a target', () => {
    expect(KIKI_POINTER_TIP).toEqual({ x: 0.15, y: 0.1 })
  })
})
