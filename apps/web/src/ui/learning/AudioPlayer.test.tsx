// @vitest-environment jsdom
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AudioPlayer, type AudioPlayerHandle, type AudioPlayerProps } from './AudioPlayer'

// jsdom has no media playback: track paused state and fire the events a browser would
const paused = new WeakMap<HTMLMediaElement, boolean>()
let play: ReturnType<typeof vi.fn>
let pause: ReturnType<typeof vi.fn>
let load: ReturnType<typeof vi.fn>
beforeEach(() => {
  play = vi.fn(function (this: HTMLMediaElement) {
    paused.set(this, false)
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  pause = vi.fn(function (this: HTMLMediaElement) {
    if (paused.get(this) === false) {
      paused.set(this, true)
      this.dispatchEvent(new Event('pause'))
    }
  })
  load = vi.fn()
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: load })
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return paused.get(this) ?? true } })
})
afterEach(cleanup)

function renderPlayer(props: Partial<AudioPlayerProps> = {}) {
  const ref = createRef<AudioPlayerHandle>()
  const onSpeedChange = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <AudioPlayer ref={ref} src="/clip.wav" title="Carrier mismatch" label="Placeholder sound, not narration" speed={1} onSpeedChange={onSpeedChange} onClose={onClose} {...props} />,
  )
  const audio = utils.container.querySelector('audio')!
  return { ...utils, ref, audio, onSpeedChange, onClose }
}

/** What the browser reports once the clip's header has loaded. */
function loaded(audio: HTMLAudioElement, seconds: number) {
  Object.defineProperty(audio, 'duration', { configurable: true, value: seconds })
  fireEvent.loadedMetadata(audio)
}

describe('AudioPlayer', () => {
  it('names itself after what is playing and always shows where the audio comes from', () => {
    renderPlayer()
    expect(screen.getByRole('region', { name: 'Listen: Carrier mismatch' })).toBeTruthy()
    expect(screen.getByText('Placeholder sound, not narration')).toBeTruthy()
  })

  it('does not start on its own, and plays and pauses from one button', () => {
    renderPlayer()
    expect(play).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Play narration' }))
    expect(play).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Pause narration' }))
    expect(pause).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play narration' })).toBeTruthy()
  })

  it('starts straight away only when asked (after the student pressed Listen)', () => {
    renderPlayer({ autoPlay: true })
    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Pause narration' })).toBeTruthy()
  })

  it('offers Play again once the clip has ended', () => {
    const { audio } = renderPlayer({ autoPlay: true })
    fireEvent.ended(audio)
    expect(screen.getByRole('button', { name: 'Play narration again' })).toBeTruthy()
  })

  it('follows the clip clock: the position slider waits for the duration, then seeks', () => {
    const { audio } = renderPlayer()
    const slider = screen.getByRole('slider', { name: 'Position' }) as HTMLInputElement
    expect(slider.disabled).toBe(true)

    loaded(audio, 41)
    expect(slider.disabled).toBe(false)
    expect(slider.max).toBe('41')

    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 12.4 })
    fireEvent.timeUpdate(audio)
    expect(slider.getAttribute('aria-valuetext')).toBe('0:12 of 0:41')

    fireEvent.change(slider, { target: { value: '30' } })
    expect(audio.currentTime).toBe(30)
  })

  it('applies the speed to the audio and reports the chosen one', () => {
    const { audio, onSpeedChange, rerender } = renderPlayer()
    const fast = screen.getByRole('button', { name: '1.25×' })
    expect(screen.getByRole('button', { name: '1×' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(fast)
    expect(onSpeedChange).toHaveBeenCalledWith(1.25)

    rerender(<AudioPlayer src="/clip.wav" title="Carrier mismatch" label="x" speed={1.25} onSpeedChange={onSpeedChange} onClose={vi.fn()} />)
    expect(audio.playbackRate).toBe(1.25)
    expect(fast.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows a language switch only when two languages are offered', () => {
    const onLanguageChange = vi.fn()
    const { rerender } = renderPlayer({ languages: [{ value: 'or', label: 'Odia' }] })
    expect(screen.queryByRole('group', { name: 'Narration language' })).toBeNull()

    rerender(
      <AudioPlayer
        src="/clip.wav" title="t" label="x" speed={1} onSpeedChange={vi.fn()} onClose={vi.fn()}
        languages={[{ value: 'or', label: 'Odia' }, { value: 'en', label: 'English' }]} language="or" onLanguageChange={onLanguageChange}
      />,
    )
    const group = screen.getByRole('group', { name: 'Narration language' })
    expect(group.querySelector('[aria-pressed="true"]')?.textContent).toBe('Odia')
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(onLanguageChange).toHaveBeenCalledWith('en')
  })

  it('says plainly when a clip cannot play, and retries it', () => {
    const { audio } = renderPlayer()
    fireEvent.error(audio)
    expect(screen.getByRole('alert').textContent).toContain("Couldn't play this audio.")
    expect((screen.getByRole('button', { name: 'Play narration' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(load).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('can be paused from outside (a term chip, sign-out) and closes on request', () => {
    const { ref, onClose } = renderPlayer({ autoPlay: true })
    act(() => ref.current!.pause())
    expect(screen.getByRole('button', { name: 'Play narration' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close player' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('stops the sound when it goes away', () => {
    const { unmount } = renderPlayer({ autoPlay: true })
    pause.mockClear()
    unmount()
    expect(pause).toHaveBeenCalled()
  })
})
