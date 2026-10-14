import type { LessonTerm } from '../contracts'
import { StatusBadge } from './StatusBadge'
import styles from './TermDetails.module.css'

export type TermDetailsProps = {
  term: LessonTerm
  /** Show the term as a heading. Off inside a Sheet, whose title already names it. Default true. */
  showTerm?: boolean
}

/**
 * Everything about one technical term: the English spelling, how to say it
 * (in Odia script), the Odia meaning, the English definition and an example
 * in both languages. Shown at every dial notch, including 5. Fields the
 * content doesn't have yet are left out rather than shown empty.
 */
export function TermDetails({ term, showTerm = true }: TermDetailsProps) {
  const symbol = [term.symbol, term.unit && `unit: ${term.unit}`].filter(Boolean).join(' · ')
  return (
    <div className={styles.details}>
      <div className={styles.head}>
        {showTerm && (
          <p className={styles.term} lang="en">
            {term.term}
          </p>
        )}
        <StatusBadge label="Word" dimension="words" />
      </div>
      {symbol && <p className={styles.symbol}>{symbol}</p>}

      <dl className={styles.list}>
        {term.pronunciationOr && (
          <div>
            <dt>Say it</dt>
            <dd lang="or">{term.pronunciationOr}</dd>
          </div>
        )}
        {term.glossOr && (
          <div>
            <dt>Odia meaning</dt>
            <dd lang="or">{term.glossOr}</dd>
          </div>
        )}
        <div>
          <dt>Definition</dt>
          <dd lang="en">{term.definition}</dd>
        </div>
        {term.example && (
          <div>
            <dt>Example</dt>
            <dd>
              <span lang="en">{term.example.en}</span>
              <span lang="or">{term.example.or}</span>
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
