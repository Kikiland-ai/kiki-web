import type { BilingualText, DialLevel } from '../../contracts/api'

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

export type PlacardMode = {
  /** The text read first. */
  primary: 'or' | 'en'
  /** Notch 3: the English, shown under the Odia. */
  alsoEnglish: boolean
  /** Which terms become chips: all matched terms, or only this concept's new ones. */
  chips: 'all' | 'new'
  /** Notch 1: chips also show the Odia meaning inline. */
  showMeaning: boolean
}

/**
 * What a placard shows at each dial notch (contract §9). Term details stay
 * reachable at every notch, including 5, through the lesson's words list.
 */
export function placardMode(dial: DialLevel): PlacardMode {
  switch (dial) {
    case 1:
      return { primary: 'or', alsoEnglish: false, chips: 'all', showMeaning: true }
    case 2:
      return { primary: 'or', alsoEnglish: false, chips: 'all', showMeaning: false }
    case 3:
      return { primary: 'or', alsoEnglish: true, chips: 'all', showMeaning: false }
    case 4:
      return { primary: 'en', alsoEnglish: false, chips: 'all', showMeaning: false }
    case 5:
      return { primary: 'en', alsoEnglish: false, chips: 'new', showMeaning: false }
    default:
      throw new Error('Invalid language dial level')
  }
}

/** A title in the dial's language: Odia at notches 1–3, English at 4–5. */
export function pick(text: BilingualText, dial: DialLevel): { text: string; lang: 'or' | 'en' } {
  return dial <= 3 && !lacksOdia(text) ? { text: text.or, lang: 'or' } : { text: text.en, lang: 'en' }
}
