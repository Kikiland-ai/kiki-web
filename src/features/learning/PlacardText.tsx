import type { LessonTerm } from '../../contracts'
import { TermChip } from '../../ui'
import { splitTerms } from './termSegments'

export type PlacardTextProps = {
  text: string
  lang: 'or' | 'en'
  /** Terms that may become chips here. Pass [] for plain text. */
  terms: LessonTerm[]
  /** Dial notch 1: chips also show the Odia meaning. */
  showMeaning?: boolean
  className?: string
}

/** One placard paragraph, with the terms it mentions as tappable chips. */
export function PlacardText({ text, lang, terms, showMeaning = false, className }: PlacardTextProps) {
  return (
    <p lang={lang} className={className}>
      {splitTerms(text, terms).map((segment, i) =>
        typeof segment === 'string' ? (
          segment
        ) : (
          <TermChip key={`${segment.term.id}-${i}`} term={segment.term} label={segment.text} showMeaning={showMeaning} />
        ),
      )}
    </p>
  )
}
