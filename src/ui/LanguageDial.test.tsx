import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { DIAL_LEVEL_NAMES, LanguageDial, type DialLevel } from './LanguageDial'

afterEach(cleanup)

function Harness({ start = 2, suggested = null as DialLevel | null, onAccept = vi.fn() }) {
  const [value, setValue] = useState<DialLevel>(start as DialLevel)
  return <LanguageDial value={value} onChange={setValue} suggested={suggested} onAcceptSuggestion={onAccept} />
}

/** happy-dom has no layout, so give the track a fixed 248px box: notches sit every 50px from x = 24. */
function stubTrackBox(track: HTMLElement) {
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 248, height: 48, right: 248, bottom: 48, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

describe('LanguageDial', () => {
  it('is a labelled 1–5 slider with notch names from contract §9', () => {
    render(<Harness start={3} />)
    const slider = screen.getByRole('slider', { name: 'Language mix' })
    expect(slider.getAttribute('aria-valuemin')).toBe('1')
    expect(slider.getAttribute('aria-valuemax')).toBe('5')
    expect(slider.getAttribute('aria-valuenow')).toBe('3')
    expect(slider.getAttribute('aria-valuetext')).toBe('3 of 5, Odia and English stacked')
    expect(DIAL_LEVEL_NAMES).toEqual([
      'Odia, term meanings inline',
      'Odia with term chips',
      'Odia and English stacked',
      'English with term chips',
      'English',
    ])
  })

  it('moves with arrow keys, Home and End, and stays within 1–5', () => {
    render(<Harness start={2} />)
    const slider = screen.getByRole('slider')
    const now = () => slider.getAttribute('aria-valuenow')

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(now()).toBe('3')
    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    expect(now()).toBe('2')
    fireEvent.keyDown(slider, { key: 'End' })
    expect(now()).toBe('5')
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(now()).toBe('5')
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(now()).toBe('1')
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(now()).toBe('1')
  })

  it('jumps to the nearest notch on a tap, with no drag', () => {
    render(<Harness start={1} />)
    const slider = screen.getByRole('slider')
    const track = slider.parentElement!
    stubTrackBox(track)

    fireEvent.pointerDown(track, { pointerId: 1, button: 0, clientX: 176 })
    expect(slider.getAttribute('aria-valuenow')).toBe('1')
    fireEvent.pointerUp(track, { pointerId: 1, button: 0, clientX: 176 })
    expect(slider.getAttribute('aria-valuenow')).toBe('4')
  })

  it('follows a horizontal drag', () => {
    render(<Harness start={1} />)
    const slider = screen.getByRole('slider')
    const track = slider.parentElement!
    stubTrackBox(track)

    fireEvent.pointerDown(track, { pointerId: 1, button: 0, clientX: 24 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 126 })
    expect(slider.getAttribute('aria-valuenow')).toBe('3')
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 224 })
    expect(slider.getAttribute('aria-valuenow')).toBe('5')
  })

  it('does not change when a press is cancelled (the page scrolled instead)', () => {
    render(<Harness start={2} />)
    const slider = screen.getByRole('slider')
    const track = slider.parentElement!
    stubTrackBox(track)

    fireEvent.pointerDown(track, { pointerId: 1, button: 0, clientX: 224 })
    fireEvent.pointerCancel(track, { pointerId: 1 })
    fireEvent.pointerUp(track, { pointerId: 1, button: 0, clientX: 224 })
    expect(slider.getAttribute('aria-valuenow')).toBe('2')
  })

  it('shows a suggestion the student must accept', () => {
    const onAccept = vi.fn()
    render(<Harness start={2} suggested={4} onAccept={onAccept} />)
    const slider = screen.getByRole('slider')
    expect(slider.getAttribute('aria-valuenow')).toBe('2')

    fireEvent.click(screen.getByRole('button', { name: 'Try notch 4: English with term chips' }))
    expect(slider.getAttribute('aria-valuenow')).toBe('4')
    expect(onAccept).toHaveBeenCalledWith(4)
    // The suggestion is reached, so its chip goes away
    expect(screen.queryByRole('button', { name: /Try notch/ })).toBeNull()
  })

  it('hides the suggestion when it equals the current notch', () => {
    render(<Harness start={3} suggested={3} />)
    expect(screen.queryByRole('button', { name: /Try notch/ })).toBeNull()
  })
})
