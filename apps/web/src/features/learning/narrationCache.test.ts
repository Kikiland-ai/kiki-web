import { describe, expect, it, vi } from 'vitest'
import preview from '../../fixtures/concept-media-C-AM-08.json'
import { MediaManifestSchema } from '../../contracts/concept-media'
import { createNarrationCache } from './narrationCache'

const [first, second] = MediaManifestSchema.parse(preview.manifest).narration

describe('narration cache', () => {
  it('fetches each clip once per lesson and frees every clip when the lesson closes', async () => {
    const releases: string[] = []
    const load = vi.fn(async (r: typeof first) => ({ url: `blob:${r.renditionId}`, release: () => releases.push(r.renditionId) }))
    const cache = createNarrationCache(load)
    expect(await cache.get(first)).toBe(`blob:${first.renditionId}`)
    expect(await cache.get(first)).toBe(`blob:${first.renditionId}`)
    await cache.get(second)
    expect(load).toHaveBeenCalledTimes(2)
    cache.clear()
    await vi.waitFor(() => expect(releases.sort()).toEqual([first.renditionId, second.renditionId].sort()))
    await expect(cache.get(first)).rejects.toThrow('closed')
  })

  it('lets a failed fetch be retried, and aborts and frees a fetch that finishes after closing', async () => {
    let fail = true, signal: AbortSignal | undefined, finish: () => void = () => undefined
    const release = vi.fn()
    const cache = createNarrationCache(async (r, s) => {
      if (fail) { fail = false; throw new Error('offline') }
      signal = s
      await new Promise<void>(resolve => { finish = resolve })
      return { url: `blob:${r.renditionId}`, release }
    })
    await expect(cache.get(first)).rejects.toThrow('offline')
    const pending = cache.get(first)
    await vi.waitFor(() => expect(signal).toBeDefined())
    cache.clear()
    expect(signal!.aborted).toBe(true)
    finish()
    await expect(pending).rejects.toThrow('closed')
    expect(release).toHaveBeenCalledTimes(1)
  })
})
