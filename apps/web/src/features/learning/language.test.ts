import { describe, expect, it } from 'vitest'
import content from '../../fixtures/learning-content.json'
import { lacksOdia, pick, placardMode, shouldShowKeyIdea } from './language'

describe('placard modes (contract §9)', () => {
  it.each([
    [1, { primary: 'or', alsoEnglish: false, chips: 'all', showMeaning: true }],
    [2, { primary: 'or', alsoEnglish: false, chips: 'all', showMeaning: false }],
    [3, { primary: 'or', alsoEnglish: true, chips: 'all', showMeaning: false }],
    [4, { primary: 'en', alsoEnglish: false, chips: 'all', showMeaning: false }],
    [5, { primary: 'en', alsoEnglish: false, chips: 'new', showMeaning: false }],
  ] as const)('notch %i', (dial, mode) => {
    expect(placardMode(dial)).toEqual(mode)
  })

  it('picks Odia titles at 1–3 and English at 4–5, falling back to English when there is no Odia', () => {
    const title = { en: 'Definition', or: 'ସଂଜ୍ଞା' }
    expect(pick(title, 2)).toEqual({ text: 'ସଂଜ୍ଞା', lang: 'or' })
    expect(pick(title, 4)).toEqual({ text: 'Definition', lang: 'en' })
    expect(pick({ en: 'Analog Modulation', or: 'Analog Modulation' }, 1)).toEqual({ text: 'Analog Modulation', lang: 'en' })
  })
})

const untranslated = { en: 'Relative phase matters.', or: 'Relative phase matters.' }
const translated = { en: 'Relative phase matters.', or: 'Relative Phase ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ।' }

describe('key idea visibility', () => {
  it('spots text whose Odia is a copy of the English', () => {
    expect(lacksOdia(untranslated)).toBe(true)
    expect(lacksOdia(translated)).toBe(false)
  })

  it.each([
    [1, false],
    [2, false],
    [3, false],
    [4, true],
    [5, true],
  ] as const)('hides an untranslated key idea at notch %i: shown=%s', (dial, shown) => {
    expect(shouldShowKeyIdea(untranslated, dial)).toBe(shown)
  })

  it('shows a translated key idea at every notch', () => {
    for (const dial of [1, 2, 3, 4, 5] as const) expect(shouldShowKeyIdea(translated, dial)).toBe(true)
  })

  it("hides C-AM-08's key idea at notches 1–3 with today's content", async () => {
    const { lessons } = content
    const keyIdea = lessons['C-AM-08'].keyIdea
    expect(shouldShowKeyIdea(keyIdea, 2)).toBe(false)
    expect(shouldShowKeyIdea(keyIdea, 4)).toBe(true)
  })
})
