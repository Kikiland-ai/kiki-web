import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { LessonTerm } from '../contracts'
import { TermChip } from './TermChip'
import { TermDetails } from './TermDetails'

afterEach(cleanup)

const phaseError: LessonTerm = {
  id: 'T-AM-08-1',
  term: 'phase error',
  definition: 'Relative phase mismatch between receiver and transmitter carriers.',
  pronunciationOr: 'ଫେଜ୍ ଏରର୍',
  glossOr: 'ଦୁଇ Carrier ମଧ୍ୟରେ ଆବଶ୍ୟକ ମେଳଠାରୁ Phase ତଫାତ।',
  example: {
    en: 'A 90-degree relative phase error suppresses the ideal recovered message.',
    or: '90-degree relative Phase error ideal Recovered message କୁ କମାଏ।',
  },
}

describe('TermChip', () => {
  it('is a button showing the untranslated English term', () => {
    render(<TermChip term={phaseError} />)
    const chip = screen.getByRole('button', { name: 'phase error' })
    expect(chip.getAttribute('lang')).toBe('en')
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('opens the term details in a sheet, and reports the open', () => {
    const onOpen = vi.fn()
    render(<TermChip term={phaseError} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'phase error' }))
    const sheet = screen.getByRole('dialog', { name: 'phase error' })
    expect(within(sheet).getByText('ଫେଜ୍ ଏରର୍')).toBeTruthy()
    // Named once, by the sheet title
    expect(within(sheet).getAllByText('phase error')).toHaveLength(1)
    expect(onOpen).toHaveBeenCalledWith('T-AM-08-1')
  })

  it('works inside a paragraph: the sheet renders outside it', () => {
    const { container } = render(
      <p>
        A <TermChip term={phaseError} /> of 90°.
      </p>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'phase error' }))
    expect(container.querySelector('p dialog')).toBeNull()
    expect(Array.from(document.body.children).some((el) => el.tagName === 'DIALOG')).toBe(true)
  })

  it('shows the Odia meaning inline at notch 1 only', () => {
    const { rerender } = render(<TermChip term={phaseError} />)
    expect(screen.queryByText(/Phase ତଫାତ/)).toBeNull()
    rerender(<TermChip term={phaseError} showMeaning />)
    expect(screen.getByRole('button', { name: /phase error.*Phase ତଫାତ/ })).toBeTruthy()
  })
})

describe('TermDetails', () => {
  it('shows spelling, pronunciation, Odia meaning, definition and a bilingual example', () => {
    render(<TermDetails term={phaseError} />)
    expect(screen.getByText('phase error')).toBeTruthy()
    expect(screen.getByText('ଫେଜ୍ ଏରର୍').getAttribute('lang')).toBe('or')
    expect(screen.getByText(phaseError.glossOr!).getAttribute('lang')).toBe('or')
    expect(screen.getByText(phaseError.definition)).toBeTruthy()
    expect(screen.getByText(phaseError.example!.en).getAttribute('lang')).toBe('en')
    expect(screen.getByText(phaseError.example!.or).getAttribute('lang')).toBe('or')
    expect(screen.getByText('Word')).toBeTruthy()
  })

  it('leaves out fields the content does not have yet', () => {
    render(<TermDetails term={{ id: 'T-AM-08-3', term: 'beating', definition: 'A varying signal envelope.' }} />)
    expect(screen.queryByText('Say it')).toBeNull()
    expect(screen.queryByText('Odia meaning')).toBeNull()
    expect(screen.queryByText('Example')).toBeNull()
    expect(screen.getByText('Definition')).toBeTruthy()
  })
})
