import type { LessonTerm } from '../../contracts/api'

export type TermSegment = string | { term: LessonTerm; text: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits text into plain runs and term matches, so terms can become chips.
 * Each term matches once (its first appearance), case-insensitively, as a
 * whole English word: "phase" doesn't match inside "phases". Longer terms win
 * over shorter ones they contain ("phase error" before "phase"). Works on
 * Odia text too, which keeps English terms in Latin script.
 */
export function splitTerms(text: string, terms: LessonTerm[]): TermSegment[] {
  const matches: { start: number; end: number; term: LessonTerm }[] = []
  const byLength = [...terms].sort((a, b) => b.term.length - a.term.length)
  for (const term of byLength) {
    const pattern = new RegExp(`(?<![A-Za-z])${escape(term.term)}(?![A-Za-z])`, 'gi')
    for (const m of text.matchAll(pattern)) {
      const start = m.index
      const end = start + m[0].length
      if (matches.some((x) => start < x.end && end > x.start)) continue
      matches.push({ start, end, term })
      break
    }
  }
  matches.sort((a, b) => a.start - b.start)

  const segments: TermSegment[] = []
  let at = 0
  for (const m of matches) {
    if (m.start > at) segments.push(text.slice(at, m.start))
    segments.push({ term: m.term, text: text.slice(m.start, m.end) })
    at = m.end
  }
  if (at < text.length) segments.push(text.slice(at))
  return segments
}
