import type { BilingualText, DialLevel } from '../../contracts'

/** True when the content has no Odia for this text yet, so the English was copied into `or`. */
export function lacksOdia(text: BilingualText): boolean {
  return text.or.trim() === text.en.trim()
}

/**
 * The lesson's one-line key idea. None of the ten has Odia yet (see the
 * fixture's meta.notes), so it is hidden at the Odia notches 1–3 rather than
 * shown as English there. It appears at every notch once real Odia is added.
 */
export function shouldShowKeyIdea(keyIdea: BilingualText, dial: DialLevel): boolean {
  return dial >= 4 || !lacksOdia(keyIdea)
}
