import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { LabStepper, type LabStep } from './LabStepper'

afterEach(cleanup)

const steps = (current: number, total = 12, verified: number[] = []): LabStep[] =>
  Array.from({ length: total }, (_, i) => {
    const n = i + 1
    return {
      id: `CP-${n}`,
      number: n,
      label: `Step label ${n}`,
      state: n < current ? 'done' : n === current ? 'current' : 'upcoming',
      evidence: verified.includes(n) ? 'verified' : 'self_reported',
    }
  })

describe('LabStepper', () => {
  it('shows done steps, the current one with its card, the next two, and folds the rest', () => {
    render(
      <LabStepper label="DSB-SC steps" steps={steps(4)}>
        <p>Current card</p>
      </LabStepper>,
    )
    const list = screen.getByRole('list', { name: 'DSB-SC steps' })
    const items = within(list).getAllByRole('listitem')
    // 3 done + current + 2 ahead + "more"
    expect(items).toHaveLength(7)
    expect(items[3].getAttribute('aria-current')).toBe('step')
    expect(within(items[3]).getByText('Current card')).toBeTruthy()
    expect(items[3].textContent).toContain('Step 4, now:')
    expect(items[4].textContent).toContain('Step 5, coming up:')
    expect(items[6].textContent).toContain('6 more steps after these')
    expect(screen.queryByText('Step label 7')).toBeNull()
  })

  it('labels a tick as the student\'s own unless the tool verified it', () => {
    render(<LabStepper label="Steps" steps={steps(3, 4, [2])} />)
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('Your tick')).toBeTruthy()
    expect(within(items[1]).getByText('Verified')).toBeTruthy()
    expect(items[1].className).toContain('isVerified')
    expect(items[0].className).not.toContain('isVerified')
  })

  it('has no fold when everything fits', () => {
    render(<LabStepper label="Steps" steps={steps(2, 3)} />)
    expect(screen.queryByText(/more step/)).toBeNull()
  })
})
