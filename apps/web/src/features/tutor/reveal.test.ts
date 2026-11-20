import { expect, it } from 'vitest';
import type { Segment } from '../../contracts/tutor';
import { dueItems, planReveals, textModeDelays } from './reveal';

const seg = (say: string, reveals: { item: string; on: string }[], kind: Segment['kind'] = 'show'): Segment => ({ kind, say, reveals, focus: [] });

it('places enter, say:<phrase> and speech-end at the right offsets in the joined brief', () => {
  const segments = [
    seg('', [{ item: 'traces', on: 'enter' }], 'ack'),
    seg('After the lowpass filter, the recovery gain restores it.', [
      { item: 'lpf', on: 'say:lowpass filter' }, { item: 'gain', on: 'say:recovery gain' }, { item: 'id', on: 'enter' }]),
    seg('What fraction comes out?', [{ item: 'end', on: 'speech-end' }], 'probe'),
  ];
  const say = segments.map(s => s.say).join(' ');
  const plan = planReveals(segments);
  const at = Object.fromEntries(plan.map(p => [p.item, p.offset]));
  expect(at.traces).toBe(0);
  expect(at.id).toBe(1);
  expect(say.slice(0, at.lpf)).toMatch(/lowpass filter$/);
  expect(say.slice(0, at.gain)).toMatch(/recovery gain$/);
  expect(at.end).toBe(say.length);
  expect(plan.map(p => p.offset)).toEqual([...plan.map(p => p.offset)].sort((a, b) => a - b));
});

it('falls back to the segment end when a guided line never says the phrase', () => {
  const plan = planReveals([seg('Put a number on it.', [{ item: 'x', on: 'say:recovery gain' }])]);
  expect(plan[0].offset).toBe('Put a number on it.'.length);
});

it('releases items as speech progresses and spreads them in text mode', () => {
  const plan = [{ item: 'a', offset: 0 }, { item: 'b', offset: 10 }, { item: 'c', offset: 40 }];
  expect(dueItems(plan, 0)).toEqual(['a']);
  expect(dueItems(plan, 12)).toEqual(['a', 'b']);
  expect(dueItems(plan, 99)).toEqual(['a', 'b', 'c']);
  expect(textModeDelays(plan, 40, 1000)).toEqual([{ item: 'a', ms: 0 }, { item: 'b', ms: 250 }, { item: 'c', ms: 1000 }]);
});
