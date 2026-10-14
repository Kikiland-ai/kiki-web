import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ErrorState } from './ErrorState'

afterEach(cleanup)

describe('ErrorState', () => {
  it('shows the message as an alert, with no Retry by default', () => {
    render(<ErrorState message="Couldn't load the lesson." />)
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load the lesson.")
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers Retry when onRetry is given', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="No signal." onRetry={onRetry} />)
    const retry = screen.getByRole('button', { name: 'Retry' })
    expect(retry.className).toContain('secondary')
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
