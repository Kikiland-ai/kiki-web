import { useId } from 'react'
import { Link } from 'react-router'
import type { ConceptProgress, Dimension, DimensionCoverage } from '../contracts'
import { Kiki } from './Kiki'
import { MasteryRing } from './MasteryRing'
import { describeMastery } from './mastery'
import { StatusBadge } from './StatusBadge'
import styles from './MapNode.module.css'

export type ConceptStatus = ConceptProgress['status']

export type MapNodeProps = {
  /** Where the node goes, e.g. `/concepts/C-AM-08`. */
  to: string
  /** The concept's place in the chapter, shown inside the ring. */
  order: number
  title: string
  /** Odia title, shown under the English one. */
  titleOr?: string
  status: ConceptStatus
  /** Mastery ring values. Missing or null dimensions read "Not assessed". */
  rings?: Partial<Record<Dimension, DimensionCoverage>>
  /** The concept to study next: Kiki marks it. */
  next?: boolean
  /** One of the concepts the lab needs. */
  requiredForLab?: boolean
  /** tile: a node on the map. row: a full-width list item for phones. Default tile. */
  layout?: 'tile' | 'row'
}

const STATUS_BADGE: Record<ConceptStatus, { label: string; tone: 'neutral' | 'success' | 'not_yet' } | null> = {
  not_started: null,
  learning: { label: 'Learning', tone: 'neutral' },
  revisit: { label: 'Revisit', tone: 'not_yet' },
  passed: { label: 'Check passed', tone: 'success' },
}

/**
 * One concept on the chapter map, linking to its lesson. Ported from
 * Breadboard MapNode, with the contract's concept statuses. Every status is
 * written as a word; the LED and outline only repeat it.
 */
export function MapNode({
  to,
  order,
  title,
  titleOr,
  status,
  rings = {},
  next = false,
  requiredForLab = false,
  layout = 'tile',
}: MapNodeProps) {
  const badge = STATUS_BADGE[status]
  const descriptionId = useId()
  const classes = [styles.node, styles[layout], styles[status], next && styles.next].filter(Boolean).join(' ')

  return (
    // Named by the concept; the mastery summary is its description, read after a pause
    <Link to={to} className={classes} aria-describedby={descriptionId}>
      <span className={styles.body} aria-hidden="true">
        {next && (
          <span className={styles.pin}>
            <Kiki state="pointing" size={layout === 'tile' ? 28 : 24} label="" />
          </span>
        )}
        <span className={styles.led} aria-hidden="true" />
        <MasteryRing values={rings} size={44} label="Mastery">
          {order}
        </MasteryRing>
      </span>
      <span className={styles.text}>
        <span className={styles.title}>
          <span className={styles.srOnly}>Concept {order}: </span>
          {title}
        </span>
        {titleOr && (
          <span className={styles.titleOr} lang="or">
            {titleOr}
          </span>
        )}
        <span className={styles.badges}>
          {next && <StatusBadge label="Up next" tone="neutral" />}
          {badge ? (
            <StatusBadge label={badge.label} tone={badge.tone} dimension={status === 'passed' ? 'concept' : undefined} />
          ) : (
            <span className={styles.srOnly}>Not started</span>
          )}
          {requiredForLab && <StatusBadge label="For the lab" dimension="lab" />}
        </span>
      </span>
      <span id={descriptionId} className={styles.srOnly}>
        Mastery: {describeMastery(rings)}
      </span>
    </Link>
  )
}
