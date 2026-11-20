import type { z } from 'zod';
import { BlockParams, SpectrumParams, WaveformParams, type LText } from '../../contracts/tutor';
import styles from './Tutor.module.css';

type Lang = 'en' | 'or';
const pick = (t: LText | undefined, lang: Lang) => (t ? (lang === 'or' && t.or) || t.en : '');

/** y(t) = Σ a·cos(2π f t + φ). Deterministic: the board shows the maths, not a generated drawing. */
export function sample(tones: z.infer<typeof WaveformParams>['series'][number]['tones'], t0: number, t1: number, n = 360) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    let y = 0;
    for (const { a, f, phaseDeg = 0 } of tones) y += a * Math.cos(2 * Math.PI * f * t + (phaseDeg * Math.PI) / 180);
    pts.push([t, y]);
  }
  return pts;
}

const W = 320, H = 150, PAD = 22;

export function Waveform({ params, lang, caption }: { params: unknown; lang: Lang; caption: string }) {
  const p = WaveformParams.parse(params);
  const [t0, t1] = p.t, [y0, y1] = p.yRange;
  const x = (t: number) => PAD + ((t - t0) / (t1 - t0)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - y0) / (y1 - y0)) * (H - 2 * PAD);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.figure} role="img" aria-label={caption}>
      <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} className={styles.axis} />
      {p.series.map((s, i) => (
        <path key={i} data-series={i} className={styles[`wave_${s.style ?? 'signal'}`]} fill="none"
          d={sample(s.tones, t0, t1).map(([t, v], k) => `${k ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('')} />
      ))}
      <g className={styles.legend}>
        {p.series.map((s, i) => <text key={i} x={PAD + i * 92} y={12} className={styles[`wave_${s.style ?? 'signal'}`] + ' ' + styles.legendText}>{pick(s.label, lang)}</text>)}
      </g>
      {p.xLabel && <text x={W - PAD} y={H - 4} textAnchor="end" className={styles.axisLabel}>{pick(p.xLabel, lang)}</text>}
    </svg>
  );
}

export function Spectrum({ params, lang, caption }: { params: unknown; lang: Lang; caption: string }) {
  const p = SpectrumParams.parse(params);
  const [f0, f1] = p.fRange;
  const top = Math.max(...p.lines.map(l => l.a), 1e-9);
  const x = (f: number) => PAD + ((f - f0) / (f1 - f0)) * (W - 2 * PAD);
  const y = (a: number) => H - PAD - (a / top) * (H - 2 * PAD - 16);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.figure} role="img" aria-label={caption}>
      {(p.bands ?? []).map(([a, b], i) => <rect key={i} x={x(a)} width={Math.max(1, x(b) - x(a))} y={PAD} height={H - 2 * PAD} className={styles.band} />)}
      <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className={styles.axis} />
      {p.lines.map((l, i) => (
        <g key={i} className={styles[`line_${l.style ?? 'sideband'}`]} data-f={l.f}>
          <line x1={x(l.f)} x2={x(l.f)} y1={H - PAD} y2={y(l.a)} strokeWidth={3} />
          <circle cx={x(l.f)} cy={y(l.a)} r={3} />
          <text x={x(l.f)} y={y(l.a) - 6} textAnchor="middle" className={styles.lineLabel}>{l.label ? pick(l.label, lang) : `${l.f}`}</text>
        </g>
      ))}
      <text x={W - PAD} y={H - 4} textAnchor="end" className={styles.axisLabel}>f ({p.unit ?? 'kHz'})</text>
    </svg>
  );
}

/** A left-to-right signal chain; blocks that feed a block from the side (oscillators) sit above it. */
export function layoutBlocks(p: z.infer<typeof BlockParams>) {
  const side = new Set(p.blocks.filter(b => b.kind === 'oscillator').map(b => b.id));
  const into = new Map<string, string[]>();
  p.edges.forEach(e => into.set(e.to, [...(into.get(e.to) ?? []), e.from]));
  const chain: string[] = [];
  let cur = p.blocks.find(b => b.kind === 'source')?.id ?? p.blocks.find(b => !side.has(b.id) && !(into.get(b.id) ?? []).some(f => !side.has(f)))?.id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur); chain.push(cur);
    cur = p.edges.find(e => e.from === cur && !side.has(e.to))?.to;
  }
  const pos = new Map<string, { col: number; row: number }>();
  chain.forEach((id, col) => pos.set(id, { col, row: 1 }));
  p.blocks.forEach(b => {
    if (pos.has(b.id)) return;
    const target = p.edges.find(e => e.from === b.id)?.to;
    pos.set(b.id, { col: target && pos.has(target) ? pos.get(target)!.col : chain.length, row: 0 });
  });
  return { pos, cols: Math.max(chain.length, 1) };
}

export function BlockDiagram({ params, lang, caption }: { params: unknown; lang: Lang; caption: string }) {
  const p = BlockParams.parse(params);
  const { pos, cols } = layoutBlocks(p);
  const bw = 88, bh = 44, gx = 22, gy = 30, width = cols * (bw + gx) + gx, height = 2 * (bh + gy) + 10;
  const box = (id: string) => { const { col, row } = pos.get(id)!; return { x: gx + col * (bw + gx), y: 10 + row * (bh + gy) }; };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.figure} role="img" aria-label={caption}>
      <defs><marker id="kiki-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" className={styles.arrowHead} /></marker></defs>
      {p.edges.map((e, i) => {
        const a = box(e.from), b = box(e.to), same = pos.get(e.from)!.row === pos.get(e.to)!.row;
        const [x1, y1, x2, y2] = same ? [a.x + bw, a.y + bh / 2, b.x, b.y + bh / 2] : [a.x + bw / 2, a.y + bh, b.x + bw / 2, b.y];
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.edge} markerEnd="url(#kiki-arrow)" />;
      })}
      {p.blocks.map(b => {
        const { x, y } = box(b.id);
        return (
          <g key={b.id} data-block={b.id}>
            <rect x={x} y={y} width={bw} height={bh} rx={6} className={[styles.block, styles[`block_${b.kind}`]].filter(Boolean).join(' ')} />
            <foreignObject x={x + 3} y={y + 3} width={bw - 6} height={bh - 6}>
              <div className={styles.blockLabel} lang={lang === 'or' && b.label.or ? 'or' : 'en'}>{pick(b.label, lang)}</div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
