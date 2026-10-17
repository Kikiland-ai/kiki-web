import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import styles from './Sheet.module.css'

export type SheetProps = {
  open: boolean
  /** Called on Esc, backdrop tap and the close button. The caller sets `open` to false. */
  onClose: () => void
  title: ReactNode
  children: ReactNode
}

/**
 * Bottom sheet on phone (< 600px), right side panel from 600px up.
 *
 * Built on a modal `<dialog>`: the page behind is inert, so focus stays in
 * the sheet. Esc and a tap on the backdrop call `onClose`. On close, focus
 * returns to the opener without scrolling, and the page keeps its scroll
 * position (the page is only locked from scrolling while the sheet is open).
 * Rendered into document.body, so it can be opened from inside running text
 * (a <dialog> can't sit inside a <p>).
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const pressedBackdrop = useRef(false)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    if (!dialog.open) dialog.showModal()

    return () => {
      if (dialog.open) dialog.close()
      root.style.overflow = previousOverflow
      openerRef.current?.focus({ preventScroll: true })
      openerRef.current = null
    }
  }, [open])

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`learning-sheet ${styles.sheet}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: keep the dialog controlled by `open`
        event.preventDefault()
        onCloseRef.current()
      }}
      onClose={() => {
        // Closed by the browser (e.g. a form with method="dialog") while still open
        if (open) onCloseRef.current()
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        // The dialog box itself is only reachable through its ::backdrop
        if (event.target === event.currentTarget && pressedBackdrop.current) onCloseRef.current()
        pressedBackdrop.current = false
      }}
    >
      {open && (
        <div className={styles.panel}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.close} onClick={() => onCloseRef.current()} aria-label="Close">
              <CloseIcon />
            </button>
          </header>
          <div className={styles.body}>{children}</div>
        </div>
      )}
    </dialog>,
    document.body,
  )
}
