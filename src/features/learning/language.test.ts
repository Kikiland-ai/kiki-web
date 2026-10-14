import { describe, expect, it } from 'vitest'
import { loadFixtureContent } from '../../fixtures'
import { lacksOdia, shouldShowKeyIdea } from './language'

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
    const { lessons } = await loadFixtureContent()
    const keyIdea = lessons['C-AM-08'].keyIdea
    expect(shouldShowKeyIdea(keyIdea, 2)).toBe(false)
    expect(shouldShowKeyIdea(keyIdea, 4)).toBe(true)
  })
})
