import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findNarration, narrationLabel } from './narration'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))
const placards = ['CARD-AM-08-definition', 'CARD-AM-08-concept', 'CARD-AM-08-application', 'CARD-AM-08-recap']

describe('narration clips', () => {
  it('has a clip for every C-AM-08 placard in both languages, and each file exists', () => {
    for (const placardId of placards) {
      for (const lang of ['or', 'en'] as const) {
        const clip = findNarration('C-AM-08', placardId, lang)
        expect(clip, `${placardId} ${lang}`).not.toBeNull()
        expect(existsSync(join(publicDir, clip!.src))).toBe(true)
        expect(clip!.timing).toBe('clip_duration_only')
      }
    }
  })

  it('has none for lessons without audio, so Listen stays hidden there', () => {
    expect(findNarration('C-AM-01', 'CARD-AM-01-concept', 'or')).toBeNull()
    expect(findNarration('C-AM-08', 'CARD-AM-08-unknown', 'en')).toBeNull()
  })

  it('labels every clip by where it comes from, never as reviewed unless it is', () => {
    expect(narrationLabel({ narrationKind: 'fixture', reviewed: false })).toBe('Placeholder sound, not narration')
    expect(narrationLabel({ narrationKind: 'generated', reviewed: false })).toBe('Sample audio · machine voice, not reviewed')
    expect(narrationLabel({ narrationKind: 'recorded', reviewed: false })).toBe('Sample audio · not reviewed')
    expect(narrationLabel({ narrationKind: 'generated', reviewed: true })).toBe('Machine voice')
    const clip = findNarration('C-AM-08', placards[0], 'or')!
    expect(clip.reviewed).toBe(false)
    expect(narrationLabel(clip)).toBe('Sample audio · machine voice, not reviewed')
  })
})
