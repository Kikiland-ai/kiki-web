import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { StatusBadge } from './StatusBadge'
import { CloseIcon, PauseIcon, PlayIcon, RetryIcon } from './icons'
import styles from './AudioPlayer.module.css'

export const AUDIO_SPEEDS = [0.75, 1, 1.25] as const
export type AudioSpeed = (typeof AUDIO_SPEEDS)[number]

export type AudioPlayerHandle = { pause(): void }

export type AudioPlayerProps = {
  /** null while the clip is still being fetched; the player is shown, its controls wait. */
  src: string | null
  /** Fetching the clip failed; Retry asks for it again. */
  loadError?: string
  onRetryLoad?: () => void
  /** Identifies the clip (e.g. its rendition) on the audio element, for tests and debugging. */
  mediaId?: string
  /** What is playing, e.g. the placard title; names the player for screen readers. */
  title: string
  /** Where the audio comes from, always visible, e.g. "Placeholder sound, not narration". */
  label: string
  /** A limitation worth stating beside the label, e.g. that words are not highlighted. */
  detail?: string
  speed: AudioSpeed
  onSpeedChange: (speed: AudioSpeed) => void
  /** Offered only when two languages are on screen at once (dial notch 3). */
  languages?: { value: string; label: string }[]
  language?: string
  onLanguageChange?: (value: string) => void
  onClose: () => void
  /** Start straight away; only after the student pressed Listen, never on its own. */
  autoPlay?: boolean
  ref?: Ref<AudioPlayerHandle>
}

const clock = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

/**
 * Plays one narration clip. Timing comes from the audio element's own clock
 * (never fixed timers), so position and speed stay true to the sound.
 * There is no text highlighting: clips have no sentence alignment yet.
 */
export function AudioPlayer({ src, loadError, onRetryLoad, mediaId, title, label, detail, speed, onSpeedChange, languages, language, onLanguageChange, onClose, autoPlay, ref }: AudioPlayerProps) {
  const audio = useRef<HTMLAudioElement>(null)
  const started = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)

  useImperativeHandle(ref, () => ({ pause: () => audio.current?.pause() }), [])

  useEffect(() => {
    const el = audio.current
    return () => el?.pause()
  }, [])

  useEffect(() => {
    const hidden = () => { if (document.hidden) audio.current?.pause() }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  }, [])

  // Starts once, when the clip arrives after Listen; a new clip remounts the player. A browser that
  // needs a fresh gesture rejects play() here, and the student presses Play instead.
  useEffect(() => {
    const el = audio.current
    if (!el || !src || !autoPlay || started.current) return
    started.current = true
    el.play().catch(() => setPlaying(false))
  }, [src, autoPlay])

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed
  }, [speed])

  function toggle() {
    const el = audio.current
    if (!el) return
    if (el.paused) el.play().catch(() => setFailed(true))
    else el.pause()
  }

  function retry() {
    setFailed(false)
    audio.current?.load()
  }

  const playLabel = playing ? 'Pause narration' : ended ? 'Play narration again' : 'Play narration'

  return (
    <section className={styles.player} aria-label={`Listen: ${title}`}>
      <div className={styles.top}>
        <StatusBadge label={label} />
        <button type="button" className={styles.icon} aria-label="Close player" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </div>
      {detail && <p className={styles.detail}>{detail}</p>}

      <div className={styles.controls}>
        <button type="button" className={styles.play} aria-label={playLabel} onClick={toggle} disabled={failed || !src}>
          {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <input
          type="range"
          className={styles.scrub}
          aria-label="Position"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          aria-valuetext={`${clock(current)} of ${clock(duration)}`}
          disabled={!src || !duration || failed}
          onChange={(e) => {
            const position = Number(e.currentTarget.value)
            setCurrent(position)
            if (audio.current) audio.current.currentTime = position
          }}
        />
        <span className={styles.time} aria-hidden="true">
          {clock(current)} / {clock(duration)}
        </span>
      </div>

      <div className={styles.options}>
        <div role="group" aria-label="Speed" className={styles.segments}>
          {AUDIO_SPEEDS.map((s) => (
            <button key={s} type="button" className={styles.segment} aria-pressed={speed === s} onClick={() => onSpeedChange(s)}>
              {s}×
            </button>
          ))}
        </div>
        {languages && languages.length > 1 && (
          <div role="group" aria-label="Narration language" className={styles.segments}>
            {languages.map((l) => (
              <button key={l.value} type="button" className={styles.segment} aria-pressed={language === l.value} onClick={() => onLanguageChange?.(l.value)}>
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!src && !loadError && <p role="status" className={styles.loading}>Loading narration…</p>}
      {loadError && (
        <p role="alert" className={styles.error}>
          {loadError}
          <button type="button" className={styles.retry} onClick={onRetryLoad}>
            <RetryIcon size={18} />
            Retry
          </button>
        </p>
      )}

      {failed && (
        <p role="alert" className={styles.error}>
          Couldn't play this audio.
          <button type="button" className={styles.retry} onClick={retry}>
            <RetryIcon size={18} />
            Retry
          </button>
        </p>
      )}

      <audio
        ref={audio}
        src={src ?? undefined}
        data-media-id={mediaId}
        preload="metadata"
        onPlay={() => { setPlaying(true); setEnded(false) }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setEnded(true) }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = speed }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onError={() => { setFailed(true); setPlaying(false) }}
      />
    </section>
  )
}
