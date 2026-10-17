import type { NarrationRendition } from '../../contracts/concept-media'
import type { LoadedMedia } from '../../contracts/services'

export type NarrationCache = {
  /** A playable URL for the clip, fetched once per lesson; a failed fetch can be asked for again. */
  get(rendition: NarrationRendition): Promise<string>
  /** Stops pending fetches and frees every loaded clip (leaving the lesson, signing out). */
  clear(): void
}

export function createNarrationCache(load: (rendition: NarrationRendition, signal: AbortSignal) => Promise<LoadedMedia>): NarrationCache {
  const controller = new AbortController()
  const entries = new Map<string, Promise<LoadedMedia>>()
  let cleared = false
  return {
    get(rendition) {
      if (cleared) return Promise.reject(new Error('This lesson was closed.'))
      const id = rendition.renditionId
      let entry = entries.get(id)
      if (!entry) {
        const loading = load(rendition, controller.signal).then((media) => {
          if (!cleared) return media
          media.release()
          throw new Error('This lesson was closed.')
        })
        loading.catch(() => { if (entries.get(id) === loading) entries.delete(id) })
        entries.set(id, loading)
        entry = loading
      }
      return entry.then((media) => media.url)
    },
    clear() {
      cleared = true
      controller.abort()
      for (const entry of entries.values()) entry.then((media) => media.release(), () => undefined)
      entries.clear()
    },
  }
}
