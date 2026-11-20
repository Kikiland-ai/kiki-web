// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { LessonTerm } from '../../contracts/api'
import { PlacardText } from './PlacardText'

afterEach(cleanup)
const text = 'A 60 degree error leaves half amplitude; a 90 degree error suppresses it.'
const term = { id: 'T-1', term: 'amplitude' } as LessonTerm
const marked = () => screen.getAllByTestId('reading-now').map((m) => m.textContent).join('')

describe('PlacardText reading highlight', () => {
  it('marks only the stretch being read, keeping the full text and term chips', () => {
    const start = text.indexOf('a 90')
    const { container } = render(<PlacardText text={text} lang="en" terms={[term]} highlights={[{ start, end: text.length }]} />)
    expect(container.textContent).toBe(text)
    expect(marked()).toBe('a 90 degree error suppresses it.')
  })

  it('marks a term chip inside the stretch', () => {
    render(<PlacardText text={text} lang="en" terms={[term]} highlights={[{ start: 0, end: text.indexOf(';') }]} />)
    expect(marked()).toBe('A 60 degree error leaves half amplitude')
  })

  it('splits the sentence into words already spoken and words ahead', () => {
    const start = text.indexOf('a 90'), split = text.indexOf(' suppresses')
    const { container } = render(<PlacardText text={text} lang="en" terms={[term]} highlights={[{ start, end: split, read: true }, { start: split, end: text.length }]} />)
    expect(container.textContent).toBe(text)
    expect(container.querySelector('[data-read="true"]')?.textContent).toBe('a 90 degree error')
    expect(marked()).toBe('a 90 degree error suppresses it.')
  })
})
