import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from './Button'

afterEach(cleanup)

describe('Button', () => {
  it('is a primary type="button" by default', () => {
    render(<Button>Start lesson</Button>)
    const button = screen.getByRole('button', { name: 'Start lesson' })
    expect(button.getAttribute('type')).toBe('button')
    expect(button.className).toContain('primary')
  })

  it.each(['primary', 'secondary', 'text'] as const)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain(variant)
  })

  it('keeps the icon out of the accessible name', () => {
    render(<Button icon={<svg data-testid="icon" />}>Retry</Button>)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByTestId('icon').parentElement?.getAttribute('aria-hidden')).toBe('true')
  })

  it('passes native props through and respects disabled', () => {
    const onClick = vi.fn()
    render(
      <Button type="submit" disabled onClick={onClick} aria-describedby="hint">
        Send
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement
    expect(button.type).toBe('submit')
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-describedby')).toBe('hint')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
