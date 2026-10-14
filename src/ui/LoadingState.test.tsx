import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LoadingState } from './LoadingState'

afterEach(cleanup)

describe('LoadingState', () => {
  it('announces its message as a status', () => {
    render(<LoadingState message="Loading your chapter…" />)
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Loading your chapter…')
  })

  it('shows Kiki thinking as decoration only', () => {
    render(<LoadingState message="Loading" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByRole('status').querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  })
})
