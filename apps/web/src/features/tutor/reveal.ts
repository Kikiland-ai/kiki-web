import type { Segment } from '../../contracts/tutor';

export type PlannedReveal = { item: string; offset: number };

/**
 * Where, in the brief's spoken text, each newly revealed item should appear.
 * `enter` → the start of its segment; `say:<phrase>` → where the phrase is said (or the
 * segment's end if the phrase is not in it); `speech-end` → the end of its segment.
 * Offsets index into the brief's `say`, which is the segments joined by single spaces.
 */
export function planReveals(segments: Segment[]): PlannedReveal[] {
  const plan: PlannedReveal[] = [];
  let start = 0;
  segments.forEach((seg, i) => {
    const end = start + seg.say.length;
    for (const r of seg.reveals) {
      let offset = start;
      if (r.on === 'speech-end') offset = end;
      else if (r.on.startsWith('say:')) {
        const at = seg.say.toLowerCase().indexOf(r.on.slice(4).toLowerCase());
        offset = at >= 0 ? start + at + r.on.length - 4 : end;
      }
      plan.push({ item: r.item, offset });
    }
    start = end + (i < segments.length - 1 ? 1 : 0);
  });
  return plan.sort((a, b) => a.offset - b.offset);
}

/** Items due once `spoken` characters of the brief have been delivered. */
export function dueItems(plan: PlannedReveal[], spoken: number): string[] {
  return plan.filter(p => p.offset <= spoken).map(p => p.item);
}

/** Text mode: play the plan out quickly, proportional to position in the brief. */
export function textModeDelays(plan: PlannedReveal[], totalChars: number, spanMs = 1400): { item: string; ms: number }[] {
  const total = Math.max(1, totalChars);
  return plan.map(p => ({ item: p.item, ms: Math.round((p.offset / total) * spanMs) }));
}
