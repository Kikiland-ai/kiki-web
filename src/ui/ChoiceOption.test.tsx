import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { ChoiceGroup, ChoiceOption } from './ChoiceOption'

afterEach(cleanup)

function Quiz() {
  const [answer, setAnswer] = useState<string | null>(null)
  return (
    <ChoiceGroup label="Which one?">
      {['Alpha', 'Beta', 'Gamma'].map((text) => (
        <ChoiceOption key={text} name="q1" value={text} selected={answer === text} onChange={() => setAnswer(text)}>
          {text}
        </ChoiceOption>
      ))}
    </ChoiceGroup>
  )
}

describe('ChoiceOption', () => {
  it('forms a radio group named by the question', () => {
    render(<Quiz />)
    const group = screen.getByRole('group', { name: 'Which one?' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('name'))).toEqual(['q1', 'q1', 'q1'])
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeTruthy()
  })

  // Arrow-key movement is the browser's native radio behaviour (happy-dom doesn't emulate it);
  // it is checked by hand on /kit. Here: one selection at a time, wired through onChange.
  it('selects one option at a time', () => {
    render(<Quiz />)
    const alpha = screen.getByRole('radio', { name: 'Alpha' }) as HTMLInputElement
    const beta = screen.getByRole('radio', { name: 'Beta' }) as HTMLInputElement

    fireEvent.click(screen.getByText('Alpha'))
    expect(alpha.checked).toBe(true)
    expect(alpha.closest('label')?.className).toContain('selected')

    fireEvent.click(beta)
    expect(beta.checked).toBe(true)
    expect(alpha.checked).toBe(false)
    expect(alpha.closest('label')?.className).not.toContain('selected')
  })

  it('shows "Correct" with a tick, not colour alone', () => {
    render(
      <ChoiceOption name="q" value="a" selected state="correct" onChange={() => {}}>
        Alpha
      </ChoiceOption>,
    )
    const radio = screen.getByRole('radio', { name: /Alpha\s*Correct/ })
    const label = radio.closest('label')!
    expect(label.className).toContain('correct')
    expect(within(label).getByText('Correct').querySelector('svg')).toBeTruthy()
  })

  it('shows "Not yet" with a dashed state, never a red one', () => {
    render(
      <ChoiceOption name="q" value="b" selected={false} state="not_yet" onChange={() => {}}>
        Beta
      </ChoiceOption>,
    )
    const label = screen.getByRole('radio', { name: /Beta\s*Not yet/ }).closest('label')!
    expect(label.className).toContain('not_yet')
    expect(label.className).not.toMatch(/red|wrong/)
  })

  it('can be disabled after the answer is checked', () => {
    render(
      <ChoiceOption name="q" value="a" selected={false} disabled onChange={() => {}}>
        Alpha
      </ChoiceOption>,
    )
    expect((screen.getByRole('radio', { name: 'Alpha' }) as HTMLInputElement).disabled).toBe(true)
  })
})
