import { describe, expect, it } from 'vitest'
import type { LessonTerm } from '../../contracts/api'
import { splitTerms } from './termSegments'

const term = (id: string, t: string): LessonTerm => ({ id, term: t, definition: '', pronunciationOr: '', glossOr: '' })
const phase = term('T-AM-01-3', 'phase')
const phaseError = term('T-AM-08-1', 'phase error')
const frequency = term('T-AM-01-2', 'frequency')
const mismatch = term('T-AM-08-2', 'frequency mismatch')
const dsb = term('T-AM-04-1', 'DSB-SC')

const show = (segments: ReturnType<typeof splitTerms>) =>
  segments.map((s) => (typeof s === 'string' ? s : `[${s.text}|${s.term.id}]`)).join('')

describe('splitTerms', () => {
  it('marks the first appearance of each term, keeping the text as written', () => {
    expect(show(splitTerms('Phase error moves the phase. Phase again.', [phase, phaseError]))).toBe(
      '[Phase error|T-AM-08-1] moves the [phase|T-AM-01-3]. Phase again.',
    )
  })

  it('prefers the longer term and never overlaps', () => {
    expect(show(splitTerms('A frequency mismatch, not a frequency.', [frequency, mismatch]))).toBe(
      'A [frequency mismatch|T-AM-08-2], not a [frequency|T-AM-01-2].',
    )
  })

  it('matches whole words only', () => {
    expect(show(splitTerms('Three phases.', [phase]))).toBe('Three phases.')
    expect(show(splitTerms('DSB-SC carriers', [dsb]))).toBe('[DSB-SC|T-AM-04-1] carriers')
  })

  it('finds English terms inside Odia text', () => {
    const odia = 'Frequency ସମାନ ହେଲେ relative Phase error phi ଦ୍ୱାରା'
    expect(show(splitTerms(odia, [phase, phaseError, frequency]))).toBe(
      '[Frequency|T-AM-01-2] ସମାନ ହେଲେ relative [Phase error|T-AM-08-1] phi ଦ୍ୱାରା',
    )
  })

  it('returns the text untouched when no term appears', () => {
    expect(splitTerms('Nothing here.', [phase])).toEqual(['Nothing here.'])
  })
})
