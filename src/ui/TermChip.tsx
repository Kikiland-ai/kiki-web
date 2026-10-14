import { useState } from 'react'
import type { LessonTerm } from '../contracts'
import { Sheet } from './Sheet'
import { TermDetails } from './TermDetails'
import styles from './TermChip.module.css'

export type TermChipProps = {
  term: LessonTerm
  /** The words as they appear in the text, e.g. "Phase error" at the start of a sentence. Defaults to the term. */
  label?: string
  /** Dial notch 1: show the Odia meaning inline, after the term (contract §9). */
  showMeaning?: boolean
  /** Extra class for the button, e.g. a full-size target when the chip stands alone in a list. */
  className?: string
  /** Called when the student opens the details, e.g. to record that they looked. */
  onOpen?: (termId: string) => void
}

/**
 * An English technical term inside running text, always in the same
 * dotted-underline style. Tapping it opens the term details in a Sheet, at
 * every dial notch. The term itself is never translated.
 */
export function TermChip({ term, label, showMeaning = false, className, onOpen }: TermChipProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={[styles.chip, className].filter(Boolean).join(' ')}
        lang="en"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
          onOpen?.(term.id)
        }}
      >
        {label ?? term.term}
      </button>
      {/* Outside the button: a button never wraps like text, so a long meaning inside it breaks the sentence */}
      {showMeaning && term.glossOr && (
        <span className={styles.meaning} lang="or">
          {' '}
          ({term.glossOr})
        </span>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={term.term}>
        <TermDetails term={term} showTerm={false} />
      </Sheet>
    </>
  )
}
