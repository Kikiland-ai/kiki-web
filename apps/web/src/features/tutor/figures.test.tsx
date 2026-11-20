// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { BlockDiagram, Spectrum, Waveform, layoutBlocks, sample } from './figures';
import { downsampleTo16k } from './voice/audio';

afterEach(cleanup);

it('samples sums of cosines exactly (DSB-SC product = two sidebands)', () => {
  // 2cos(2π·1t)cos(2π·10t) = cos(2π·9t) + cos(2π·11t)
  const pts = sample([{ a: 1, f: 9 }, { a: 1, f: 11 }], 0, 1, 200);
  for (const [t, y] of pts) expect(y).toBeCloseTo(2 * Math.cos(2 * Math.PI * t) * Math.cos(2 * Math.PI * 10 * t), 9);
  expect(sample([{ a: 0.5, f: 1, phaseDeg: 90 }], 0, 1, 4)[0][1]).toBeCloseTo(0, 12);
});

it('draws one path per waveform series and labels the figure', () => {
  const { container, getByRole } = render(<Waveform lang="en" caption="Recovered" params={{
    series: [{ label: { en: 'φ = 0°' }, tones: [{ a: 1, f: 1 }], style: 'reference' }, { label: { en: 'φ = 60°' }, tones: [{ a: 0.5, f: 1 }] }],
    t: [0, 2], yRange: [-1.1, 1.1] }} />);
  expect(container.querySelectorAll('path[data-series]')).toHaveLength(2);
  expect(getByRole('img', { name: 'Recovered' })).toBeTruthy();
});

it('draws a stem per spectrum line and rejects lines outside the range', () => {
  const { container } = render(<Spectrum lang="en" caption="s" params={{ lines: [{ f: 99, a: 1 }, { f: 101, a: 1 }], fRange: [97, 103] }} />);
  expect([...container.querySelectorAll('[data-f]')].map(g => g.getAttribute('data-f'))).toEqual(['99', '101']);
  expect(() => render(<Spectrum lang="en" caption="s" params={{ lines: 'nope', fRange: [0, 1] }} />)).toThrow();
});

it('lays the receiver chain left to right with the oscillator above the multiplier', () => {
  const p = { blocks: [
    { id: 'in', label: { en: 'in' }, kind: 'source' }, { id: 'lo', label: { en: 'lo' }, kind: 'oscillator' },
    { id: 'mul', label: { en: 'x' }, kind: 'multiplier' }, { id: 'lpf', label: { en: 'LPF' }, kind: 'filter' }],
    edges: [{ from: 'in', to: 'mul' }, { from: 'lo', to: 'mul' }, { from: 'mul', to: 'lpf' }] };
  const { pos } = layoutBlocks(p);
  expect(pos.get('in')).toEqual({ col: 0, row: 1 });
  expect(pos.get('mul')).toEqual({ col: 1, row: 1 });
  expect(pos.get('lpf')).toEqual({ col: 2, row: 1 });
  expect(pos.get('lo')).toEqual({ col: 1, row: 0 });
  const { container } = render(<BlockDiagram lang="en" caption="rx" params={p} />);
  expect(container.querySelectorAll('[data-block]')).toHaveLength(4);
});

it('downsamples 48 kHz to 16 kHz PCM', () => {
  const input = new Float32Array(4800).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000));
  const out = downsampleTo16k(input, 48000);
  expect(out.length).toBe(1600);
  expect(out[400] / 0x7fff).toBeCloseTo(Math.sin((2 * Math.PI * 440 * 400) / 16000), 3);
});
