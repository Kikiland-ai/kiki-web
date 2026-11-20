import { describe, expect, it } from 'vitest'
import { MediaManifestSchema } from '../../contracts/concept-media'
import record from '../../fixtures/all-cam/C-AM-08.json'
import content from '../../fixtures/learning-content.json'
import { activeCueIndex, cueTextRange, cueTrackFor, cueTracks, readingSplit } from './narrationCues'

const manifest = MediaManifestSchema.parse(record.manifest)

type Card = { id: string; body: { en: string; or: string } }
function cards(node: unknown, out: Card[] = []): Card[] {
  if (Array.isArray(node)) node.forEach((n) => cards(n, out))
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    if (typeof o.id === 'string' && o.body && typeof o.body === 'object') out.push(o as unknown as Card)
    Object.values(o).forEach((v) => cards(v, out))
  }
  return out
}
const placards = cards(content)

describe('hand-timed narration cues', () => {
  it('anchors every cue on words that open its sentence in the placard text, in order', () => {
    for (const track of cueTracks) {
      const [placardId, lang] = track.renditionId.split('.') as [string, 'en' | 'or']
      const text = placards.find((p) => p.id === placardId)!.body[lang]
      const starts = track.cues.map((c) => text.indexOf(c.from))
      expect(starts.every((i) => i >= 0), `${track.renditionId} ${JSON.stringify(starts)}`).toBe(true)
      expect(starts).toEqual([...starts].sort((a, b) => a - b))
      expect(cueTextRange(track, 0, text)!.start).toBe(0)
      expect(cueTextRange(track, track.cues.length - 1, text)!.end).toBe(text.length)
    }
  })


  it('binds every track to a real clip and keeps cues inside it, in order', () => {
    for (const track of cueTracks) {
      const clip = manifest.narration.find((r) => r.renditionId === track.renditionId)
      expect(clip, track.renditionId).toBeDefined()
      expect(clip!.audioSha256).toBe(track.audioSha256)
      const times = track.cues.map((c) => c.at)
      expect(times).toEqual([...times].sort((a, b) => a - b))
      expect(Math.max(...times)).toBeLessThan(clip!.durationSeconds)
      for (const cue of track.cues) if (cue.phi !== undefined) expect([0, 60, 90]).toContain(cue.phi)
    }
  })

  it('applies only to the exact recording it was timed against', () => {
    const clip = manifest.narration.find((r) => r.renditionId === 'CARD-AM-08-concept.en')!
    expect(cueTrackFor(clip)?.renditionId).toBe('CARD-AM-08-concept.en')
    expect(cueTrackFor({ ...clip, audioSha256: '0'.repeat(64) })).toBeNull()
    expect(cueTrackFor(null)).toBeNull()
  })

  it('moves the reading edge through the sentence and stops on whole words', () => {
    const clip = manifest.narration.find((r) => r.renditionId === 'CARD-AM-08-concept.en')!
    const track = cueTrackFor(clip)!
    const text = placards.find((p) => p.id === 'CARD-AM-08-concept')!.body.en
    const i = track.cues.findIndex((c) => c.phi === 60)
    const atStart = readingSplit(track, i, track.cues[i].at, clip.durationSeconds, text)!
    const midway = readingSplit(track, i, (track.cues[i].at + track.cues[i + 1].at) / 2, clip.durationSeconds, text)!
    const atEnd = readingSplit(track, i, track.cues[i + 1].at, clip.durationSeconds, text)!
    expect(atStart.readTo).toBe(atStart.start)
    expect(midway.readTo).toBeGreaterThan(midway.start)
    expect(midway.readTo).toBeLessThan(midway.end)
    expect(/\s/.test(text[midway.readTo])).toBe(true)
    expect(atEnd.readTo).toBe(atEnd.end)
  })

  it('finds the cue in force at a moment', () => {
    const track = cueTrackFor(manifest.narration.find((r) => r.renditionId === 'CARD-AM-08-concept.en'))!
    expect(activeCueIndex(track, 0)).toBeNull()
    expect(track.cues[activeCueIndex(track, 19)!].phi).toBe(60)
    expect(track.cues[activeCueIndex(track, 22)!].phi).toBe(90)
    expect(track.cues[activeCueIndex(track, 54)!].focus).toBe('control')
  })
})
