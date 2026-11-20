import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CamCanvas as Artifact } from '../../contracts/cam-canvas';
import Models from '../../media/cam-models.mjs';
import type { CanvasBeat } from './canvasBeats';
import { useMediaQuery } from './useMediaQuery';
import styles from './CamCanvas.module.css';

const EASE_MS = 700;

type Props = {
  artifact: Artifact;
  /** The beat in force while narration with sentence timing plays; null when not narrating. */
  cue?: CanvasBeat | null;
  /** 'stage': the narrated layout (player on top, the scene follows the voice). 'full': reading layout. */
  layout?: 'full' | 'stage';
  /** The slim narration bar shown at the top of the stage. */
  player?: ReactNode;
};

/**
 * A concept's canvas. While narration plays, it moves its controls to each sentence's beat and
 * names what is being said; touching any control hands it to the student until they follow again.
 * Exploration never saves evidence, changes lab settings or awards mastery.
 */
export function CamCanvas({ artifact, cue = null, layout = 'full', player }: Props) {
  const id = useId();
  const scene = artifact.scene;
  const [input, setInput] = useState<Record<string, number>>(() => Models.defaults(scene));
  const [following, setFollowing] = useState(true);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const frame = useRef(0);
  const inputRef = useRef(input);
  inputRef.current = input;

  const guided = Boolean(cue) && following;
  const targetKey = guided && cue ? JSON.stringify(cue.set) : null;

  // Follow the narration: ease each named control to the beat's value, always on a declared step
  useEffect(() => {
    if (!targetKey) return;
    const target = JSON.parse(targetKey) as Record<string, number>;
    const snap = (name: string, v: number) => {
      const c = scene.controls.find((x) => x.name === name)!;
      return Number(Math.min(c.max, Math.max(c.min, c.min + Math.round((v - c.min) / c.step) * c.step)).toFixed(6));
    };
    const from = { ...inputRef.current };
    const to = { ...from, ...target };
    cancelAnimationFrame(frame.current);
    if (reduceMotion) { setInput(to); return; }
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, Math.max(0, (performance.now() - start) / EASE_MS));
      const eased = 1 - (1 - t) ** 3;
      setInput(Object.fromEntries(Object.keys(to).map((k) => [k, t < 1 ? snap(k, from[k] + (to[k] - from[k]) * eased) : to[k]])));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [targetKey, reduceMotion, scene]);

  // A new clip starts in follow mode again
  const cueOpen = Boolean(cue);
  useEffect(() => { if (!cueOpen) setFollowing(true); }, [cueOpen]);

  function explore(next: Record<string, number>) {
    cancelAnimationFrame(frame.current);
    if (cue) setFollowing(false);
    setInput(next);
  }

  const result = Models.render(scene, input);
  // Only the vendored application model supplies functions. API strings/formulas are never run.
  const path = (series: typeof result.series[number]) => Array.from({ length: 901 }, (_, i) => `${i ? 'L' : 'M'}${25 + i / 900 * 550},${95 - series.fn(i / 900) * 65 / series.range}`).join(' ');
  const spectrum = result.spectrum;
  const figures = <>
    {result.series.map(series => <figure key={series.label}><figcaption>{series.label}</figcaption><svg viewBox="0 0 600 180" role="img" aria-label={series.label}><path d="M25 25V165M25 95H575" className={styles.axes} /><path d={path(series)} className={styles.trace} /></svg></figure>)}
    {result.flow && <figure><figcaption>Message and carrier independently enter the modulator; its output goes to the receiver.</figcaption><svg viewBox="0 0 600 245" role="img" aria-label="Message and carrier branches join at the modulator, then feed receiver recovery"><path d="M160 55H195L230 100M160 190H195L230 140M370 120H430" className={styles.axes} />{[[20,20,140,70],[20,155,140,70],[240,85,130,70],[440,85,140,70]].map(([x,y,w,h],i) => <g key={i}><rect x={x} y={y} width={w} height={h} rx="8" className={result.flow!.active === i ? styles.band : styles.axes} /><text x={x+w/2} y={y+h/2+5} textAnchor="middle">{result.flow!.labels[i].split(':')[0].split(' / ')[0]}</text></g>)}</svg></figure>}
    {spectrum && <figure><figcaption>{Array.isArray(spectrum) ? 'Ideal single-tone sidebands; carrier reference is not a spectral line' : 'Schematic transmitted sidebands and vestige'}</figcaption><svg viewBox="0 0 600 210" role="img" aria-label="Sideband spectrum"><path d="M40 145H570" className={styles.axes} />{Array.isArray(spectrum) ? <>{spectrum.map(s => { const x = 50 + (s.f - 1700) / 600 * 500; return <g key={s.f}><path d={`M${x} 145V45`} className={styles.trace} /><text x={x} y="30" textAnchor="middle">{s.label}</text></g>; })}<circle cx="300" cy="145" r="5" className={styles.reference} /><text x="300" y="190" textAnchor="middle">2000 Hz carrier reference</text></> : <>{(spectrum.family === 0 ? [[80, 300], [300, 520]] : spectrum.family === 1 ? [[300, 520]] : [[255, 300], [300, 520]]).map(([a, b]) => <rect key={a} x={a} y="60" width={b - a} height="85" className={styles.band} />)}<text x="300" y="195" textAnchor="middle">Frequency relative to carrier (schematic)</text></>}</svg></figure>}
  </>;
  const flowList = result.flow && <ul className={styles.flow} aria-label="Signal flow">{result.flow.labels.map((label, i) => <li key={label} aria-current={result.flow!.active === i ? 'step' : undefined}>{label}</li>)}</ul>;
  const readouts = <dl className={styles.readouts}>{result.readouts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><output>{value}</output></dd></div>)}</dl>;
  const controls = <fieldset><legend>Explore model parameters</legend>{scene.controls.map(c => <label key={c.name} htmlFor={`${id}-${c.name}`}>{c.label}: <strong>{input[c.name]} {c.unit}</strong><input id={`${id}-${c.name}`} type="range" min={c.min} max={c.max} step={c.step} value={input[c.name]} onChange={e => explore({ ...inputRef.current, [c.name]: Number(e.target.value) })} /></label>)}<button type="button" className="button button-secondary" onClick={() => explore(Models.defaults(scene))}>Reset model</button></fieldset>;
  const notes = <>
    {result.notes.map(note => <p role="note" key={note}>{note}</p>)}
    {scene.kind === 'signal' && <p role="note">Saved-model limit: two traces are drawn (signal and reference); the authored brief describes three.</p>}
    {scene.kind === 'dsb' && <p role="note">Saved-model limit: the carrier is fixed at 2000 Hz; the authored interaction also describes an adjustable carrier.</p>}
  </>;
  const sources = <details><summary>Sources and model review · scientific review {artifact.review.scientific}</summary><p>{scene.visualBrief.alt}</p><ul>{artifact.sources.map((source, i) => <li key={i}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</li>)}</ul>{scene.assumptions.map(note => <p key={note}>{note}</p>)}</details>;

  if (layout === 'stage') {
    return <section className={`${styles.canvas} ${styles.stage}`} aria-label="CAM concept canvas" data-narration-stage={player ? "" : undefined}>
      {player}
      <div className={styles.stageFigures}>{figures}</div>
      {readouts}
      {cue && <div className={styles.follow} data-testid="narration-follow">
        {following ? <>
          <p><span className={styles.live} aria-hidden="true" /><strong>Following the narration</strong>{cue.caption && <><span aria-hidden="true"> · </span><span key={cue.caption} className={styles.caption} data-testid="canvas-caption">{cue.caption}</span></>}</p>
          <button type="button" onClick={() => setFollowing(false)}>Explore on my own</button>
        </> : <>
          <p><strong>You're exploring.</strong> The narration keeps playing but won't move the scene.</p>
          <button type="button" onClick={() => setFollowing(true)}>Follow the narration</button>
        </>}
      </div>}
      <details className={styles.explore}><summary>Explore it yourself</summary>{flowList}{controls}{notes}{sources}</details>
    </section>;
  }

  return <section className={styles.canvas} aria-label="CAM concept canvas">
    <header><span className="eyebrow">EXPLORE THE CONCEPT · DRAFT</span><h2>{scene.title}</h2><p>{scene.visualBrief.description}</p></header>
    {figures}
    {flowList}
    {readouts}
    {controls}
    {notes}
    <p>Manual exploration. The scene follows the narration when you press Listen; exploring never saves progress or changes your lab.</p>
    {sources}
  </section>;
}
