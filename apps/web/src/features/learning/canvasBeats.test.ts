import { describe, expect, it } from 'vitest'
import { MediaManifestSchema } from '../../contracts/concept-media'
import content from '../../fixtures/learning-content.json'
import Models from '../../media/cam-models.mjs'
import { beatConcepts, canvasBeat } from './canvasBeats'
import { cueTextRange, cueTrackFor } from './narrationCues'

const manifests = Object.values(import.meta.glob<{ manifest: unknown }>('../../fixtures/all-cam/*.json', { eager: true, import: 'default' })).map((r) => MediaManifestSchema.parse(r.manifest))
const lessons = (content as unknown as { lessons: Record<string, { placards: { id: string; body: { en: string; or: string } }[] }> }).lessons

/** Every narrated sentence that is spoken while a canvas is on screen, with its concept. */
function canvasSentences() {
  const out: { conceptId: string; renditionId: string; text: string }[] = []
  for (const m of manifests) {
    const canvas = m.artifacts.find((a) => a.renderer === 'cam-concept-canvas/v1')
    if (!canvas || !beatConcepts.includes(m.conceptId)) continue
    for (const clip of m.narration) {
      const track = cueTrackFor(clip)
      if (!track || track.timing !== 'pauses') continue
      track.cues.forEach((cue, i) => {
        if (!canvas.placardIds.includes(cue.placardId)) return
        const text = lessons[m.conceptId].placards.find((p) => p.id === cue.placardId)!.body[clip.lang]
        const range = cueTextRange(track, i, text, cue.placardId)!
        out.push({ conceptId: m.conceptId, renditionId: clip.renditionId, text: text.slice(range.start, range.end) })
      })
    }
  }
  return out
}

describe('canvas beats', () => {
  const sentences = canvasSentences()

  it('covers every concept with a narrated canvas except C-AM-08 (hand-placed beats)', () => {
    const withCanvas = manifests.filter((m) => m.artifacts.some((a) => a.renderer === 'cam-concept-canvas/v1')).map((m) => m.conceptId)
    expect([...beatConcepts].sort()).toEqual(withCanvas.sort())
    expect(sentences.length).toBeGreaterThan(60)
  })

  it('gives every sentence spoken over a canvas a beat the model accepts', () => {
    for (const s of sentences) {
      const beat = canvasBeat(s.conceptId, s.text)
      if (process.env.SHOW_BEATS) console.log(`${s.renditionId.padEnd(26)} ${beat?.caption ?? '— none —'}  ⟵  ${s.text.slice(0, 80)}`)
      expect(beat, `${s.renditionId}: "${s.text}"`).not.toBeNull()
      const scene = manifests.find((m) => m.conceptId === s.conceptId)!.artifacts.find((a) => a.renderer === 'cam-concept-canvas/v1')!
      if (scene.renderer !== 'cam-concept-canvas/v1') throw new Error('expected a canvas')
      const input = { ...Models.defaults(scene.scene), ...beat!.set }
      expect(() => Models.values(scene.scene, input), `${s.conceptId} ${JSON.stringify(beat!.set)}`).not.toThrow()
    }
  })

  it('has no beats for an unknown concept', () => {
    expect(canvasBeat('C-AM-99', 'Phase')).toBeNull()
  })
})
