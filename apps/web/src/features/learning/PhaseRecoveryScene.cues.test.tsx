// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MediaManifestSchema, type PhaseRecoveryScene as Scene } from '../../contracts/concept-media'
import record from '../../fixtures/all-cam/C-AM-08.json'
import type { NarrationCue } from './narrationCues'
import { PhaseRecoveryScene } from './PhaseRecoveryScene'

afterEach(cleanup)
const scene = MediaManifestSchema.parse(record.manifest).artifacts.find((a) => a.renderer === 'coherent-phase-recovery/v1') as Scene
const half: NarrationCue = { at: 18.1, phi: 60, focus: 'half', caption: '60° error: half the amplitude is left', from: 'A 60 degree error' }
const nul: NarrationCue = { at: 21.2, phi: 90, focus: 'null', caption: '90° error: the message-band part is suppressed', from: 'a 90 degree error' }
const reading = () => screen.getByTestId('recovery-fraction').textContent

describe('PhaseRecoveryScene following narration', () => {
  it('stays manual with no narration open', () => {
    render(<PhaseRecoveryScene scene={scene} />)
    expect(screen.queryByTestId('narration-follow')).toBeNull()
    expect(reading()).toBe('0.50')
  })

  it('moves to each cue and says what the narration is pointing at', async () => {
    const { rerender } = render(<PhaseRecoveryScene scene={scene} cue={half} />)
    expect(screen.getByTestId('narration-follow').textContent).toContain('half the amplitude')
    await waitFor(() => expect(reading()).toBe('0.50'))
    rerender(<PhaseRecoveryScene scene={scene} cue={nul} />)
    await waitFor(() => expect(reading()).toBe('0.00'))
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('90 degrees, recovery 0.00')
  })

  it('hands control to the student and back on request', async () => {
    const { rerender } = render(<PhaseRecoveryScene scene={scene} cue={half} />)
    fireEvent.click(screen.getByRole('button', { name: /^0°/ }))
    expect(reading()).toBe('1.00')
    expect(screen.getByText(/You're exploring/)).toBeTruthy()
    rerender(<PhaseRecoveryScene scene={scene} cue={nul} />)
    expect(reading()).toBe('1.00')
    fireEvent.click(screen.getByRole('button', { name: 'Follow the narration' }))
    await waitFor(() => expect(reading()).toBe('0.00'))
  })

  it('stages the scene for narration: slim player on top, controls folded away', async () => {
    render(<PhaseRecoveryScene scene={scene} cue={half} layout="stage" player={<div>slim player</div>} />)
    expect(screen.getByText('slim player')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'How phase error scales the recovered message' })).toBeNull()
    expect(screen.getByText('Explore it yourself').closest('details')?.open).toBe(false)
    await waitFor(() => expect(reading()).toBe('0.50'))
  })
})
