import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowForwardIcon } from './icons'
import styles from './LanguageDial.module.css'

export type DialLevel = 1 | 2 | 3 | 4 | 5

/** What each notch shows, from the team contract §9. Index 0 is notch 1. */
export const DIAL_LEVEL_NAMES = [
  'Odia, term meanings inline',
  'Odia with term chips',
  'Odia and English stacked',
  'English with term chips',
  'English',
] as const

export type LanguageDialProps = {
  value: DialLevel
  /** Only the student moves the dial: called from their tap, drag, key or chip press. */
  onChange: (value: DialLevel) => void
  /** Kiki's suggested notch: a dashed ghost knob plus a chip the student can accept. */
  suggested?: DialLevel | null
  onAcceptSuggestion?: (value: DialLevel) => void
  className?: string
}

const MIN = 1
const MAX = 5
/** Drag distance (px) before a press counts as a drag rather than a tap. */
const DRAG_SLOP = 6

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, Math.round(n))) as DialLevel
const fraction = (v: number) => (v - MIN) / (MAX - MIN)

/**
 * The five-notch Odia-to-English dial. Ported from Breadboard LanguageDial.
 * Keyboard: arrows step, Home and End jump to the ends. Touch and mouse: tap
 * anywhere on the track to jump to the nearest notch, or drag the knob.
 * Vertical swipes on the track still scroll the page.
 */
export function LanguageDial({ value, onChange, suggested, onAcceptSuggestion, className }: LanguageDialProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const press = useRef<{ id: number; x: number; dragging: boolean } | null>(null)

  function commit(next: number) {
    const level = clamp(next)
    if (level === value) return
    try {
      navigator.vibrate?.(10)
    } catch {
      // Vibration is optional
    }
    onChange(level)
  }

  function levelAt(clientX: number) {
    const track = trackRef.current
    if (!track) return value
    const rect = track.getBoundingClientRect()
    const inset = rect.height / 2
    const usable = rect.width - inset * 2
    if (usable <= 0) return value
    return clamp(MIN + ((clientX - rect.left - inset) / usable) * (MAX - MIN))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    press.current = { id: event.pointerId, x: event.clientX, dragging: false }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture is best-effort
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const p = press.current
    if (!p || p.id !== event.pointerId) return
    if (!p.dragging && Math.abs(event.clientX - p.x) < DRAG_SLOP) return
    p.dragging = true
    commit(levelAt(event.clientX))
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const p = press.current
    if (!p || p.id !== event.pointerId) return
    press.current = null
    // A tap (no drag) sets the value on release, so a scroll that starts here doesn't change it
    commit(levelAt(event.clientX))
    knobRef.current?.focus({ preventScroll: true })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowRight: value + 1,
      ArrowUp: value + 1,
      PageUp: value + 1,
      ArrowLeft: value - 1,
      ArrowDown: value - 1,
      PageDown: value - 1,
      Home: MIN,
      End: MAX,
    }
    if (!(event.key in steps)) return
    event.preventDefault()
    commit(steps[event.key])
  }

  const ghost = suggested && suggested !== value ? suggested : null
  const at = (v: number) => ({ '--at': fraction(v) }) as CSSProperties

  return (
    <div className={[styles.dial, className].filter(Boolean).join(' ')}>
      <div className={styles.ends} aria-hidden="true">
        <span lang="or" className={styles.odia}>
          ଓଡ଼ିଆ
        </span>
        <span>English</span>
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          press.current = null
        }}
      >
        <div className={styles.rail} />
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={styles.notch} style={at(n)} />
        ))}
        {ghost && <div className={styles.ghost} style={at(ghost)} aria-hidden="true" />}
        <div
          ref={knobRef}
          className={styles.knob}
          style={{ ...at(value), '--angle': `${-120 + fraction(value) * 240}deg` } as CSSProperties}
          role="slider"
          tabIndex={0}
          aria-label="Language mix"
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          aria-valuenow={value}
          aria-valuetext={`${value} of 5, ${DIAL_LEVEL_NAMES[value - 1]}`}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
        />
      </div>
      <div className={styles.caption}>
        <span aria-hidden="true">
          <b>{value} of 5</b> · {DIAL_LEVEL_NAMES[value - 1]}
        </span>
        {ghost && (
          <button
            type="button"
            className={styles.suggestion}
            onClick={() => {
              commit(ghost)
              onAcceptSuggestion?.(ghost)
            }}
          >
            <ArrowForwardIcon size={18} />
            Try notch {ghost}: {DIAL_LEVEL_NAMES[ghost - 1]}
          </button>
        )}
      </div>
    </div>
  )
}
