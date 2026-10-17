import { useEffect, useState, type Ref } from 'react'
import { AudioPlayer, type AudioPlayerHandle, type AudioPlayerProps } from '../../ui/learning'
import type { NarrationRendition } from '../../contracts/concept-media'
import { readableError } from '../../services/types'
import type { NarrationCache } from './narrationCache'

type Props = Omit<AudioPlayerProps, 'src' | 'loadError' | 'onRetryLoad' | 'mediaId' | 'ref'> & {
  cache: NarrationCache
  rendition: NarrationRendition
  ref?: Ref<AudioPlayerHandle>
}

/** The Listen player for one published rendition: fetched on Listen, never ahead of the student. */
export function NarrationPlayer({ cache, rendition, ref, ...player }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    cache.get(rendition).then(
      (url) => { if (current) setSrc(url) },
      (reason: unknown) => { if (current) setError(`Couldn't load this narration. ${readableError(reason)}`) },
    )
    return () => { current = false }
  }, [cache, rendition, attempt])

  return (
    <AudioPlayer
      {...player}
      ref={ref}
      src={src}
      mediaId={rendition.renditionId}
      loadError={error || undefined}
      onRetryLoad={() => { setError(''); setAttempt((n) => n + 1) }}
    />
  )
}
