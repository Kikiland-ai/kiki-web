import type { ReactNode } from 'react'
import type { LessonTerm } from '../../contracts/api'
import { TermChip } from '../../ui/learning'
import { splitTerms } from './termSegments'

/** A stretch of the text to mark, e.g. the words of the sentence already read aloud. */
export type TextHighlight = { start: number; end: number; className?: string; read?: boolean }

export type PlacardTextProps = {
  text: string
  lang: 'or' | 'en'
  /** Terms that may become chips here. Pass [] for plain text. */
  terms: LessonTerm[]
  /** Dial notch 1: chips also show the Odia meaning. */
  showMeaning?: boolean
  className?: string
  onTermOpen?: (id:string) => void
  /** Stretches the narration is reading, in order and not overlapping; marked so the eye can follow. */
  highlights?: TextHighlight[]
}

/** One placard paragraph, with the terms it mentions as tappable chips. */
export function PlacardText({ text, lang, terms, showMeaning = false, className, onTermOpen, highlights = [] }: PlacardTextProps) {
  const ranges = highlights.filter((h) => h.end > h.start)
  const out: ReactNode[] = []
  let at = 0
  const mark = (node: ReactNode, h: TextHighlight, key: string) => (
    <mark key={key} className={h.className} data-testid="reading-now" data-read={h.read ? 'true' : undefined}>{node}</mark>
  )
  splitTerms(text, terms).forEach((segment, i) => {
    const length = typeof segment === 'string' ? segment.length : segment.text.length
    const from = at
    const to = at + length
    at = to
    if (typeof segment !== 'string') {
      const chip = <TermChip key={`${segment.term.id}-${i}`} term={segment.term} label={segment.text} showMeaning={showMeaning} onOpen={onTermOpen} />
      // A chip goes whole into the stretch holding its first character
      const h = ranges.find((r) => from >= r.start && from < r.end) ?? ranges.find((r) => from < r.end && to > r.start)
      out.push(h ? mark(chip, h, `m-${i}`) : chip)
      return
    }
    let cursor = from
    for (const [k, h] of ranges.entries()) {
      if (h.end <= cursor || h.start >= to) continue
      const a = Math.max(h.start, cursor)
      const b = Math.min(h.end, to)
      if (a > cursor) out.push(segment.slice(cursor - from, a - from))
      out.push(mark(segment.slice(a - from, b - from), h, `m-${i}-${k}`))
      cursor = b
    }
    if (cursor < to) out.push(segment.slice(cursor - from))
  })
  return (
    <p lang={lang} className={className}>
      {out}
    </p>
  )
}
