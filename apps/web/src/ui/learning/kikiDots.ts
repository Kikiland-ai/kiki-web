import type { Dimension } from '../../contracts/api'

/** Kiki's identity colours, always in this order. They are not the skill colours. */
export const KIKI_DOT_FILLS = ['var(--learning-blue)', 'var(--learning-red)', 'var(--learning-yellow)', 'var(--learning-green)']

/** Which dot grows for each dimension: green concept, red words, yellow English, blue lab. */
export const KIKI_LEAD_DOT: Record<Dimension, number> = { lab: 0, words: 1, english: 2, concept: 3 }
