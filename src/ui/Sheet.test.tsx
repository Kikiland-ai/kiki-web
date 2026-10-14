import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Sheet } from './Sheet'

afterEach(cleanup)

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Sheet
        open={open}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        title="carrier"
      >
        <p>Term details</p>
      </Sheet>
    </>
  )
}

function openSheet() {
  const opener = screen.getByRole('button', { name: 'Open' })
  opener.focus()
  fireEvent.click(opener)
  return { opener, dialog: document.querySelector('dialog') as HTMLDialogElement }
}

describe('Sheet', () => {
  it('opens as a modal dialog named by its title', () => {
    render(<Harness />)
    expect(screen.queryByText('Term details')).toBeNull()
    const { dialog } = openSheet()
    expect(dialog.open).toBe(true)
    expect(screen.getByRole('dialog', { name: 'carrier' })).toBe(dialog)
    expect(screen.getByText('Term details')).toBeTruthy()
  })

  it('closes on Esc (the dialog cancel event) and returns focus to the opener', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const { opener, dialog } = openSheet()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(dialog.open).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('closes from the Close button', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const { dialog } = openSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(dialog.open).toBe(false)
  })

  it('closes on a backdrop tap but not on a tap inside the panel', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const { dialog } = openSheet()

    const inside = screen.getByText('Term details')
    fireEvent.pointerDown(inside)
    fireEvent.click(inside)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.pointerDown(dialog)
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks page scroll only while open, without resetting it', () => {
    render(<Harness />)
    document.documentElement.style.overflow = ''
    openSheet()
    expect(document.documentElement.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.documentElement.style.overflow).toBe('')
  })
})
