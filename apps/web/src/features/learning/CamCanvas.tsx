import { useId, useState } from 'react';
import type { CamCanvas as Artifact } from '../../contracts/cam-canvas';
import Models from '../../media/cam-models.mjs';
import styles from './CamCanvas.module.css';

export function CamCanvas({ artifact }: { artifact: Artifact }) {
  const id = useId();
  const [input, setInput] = useState(() => Models.defaults(artifact.scene));
  const result = Models.render(artifact.scene, input);
  // Only the vendored application model supplies functions. API strings/formulas are never run.
  const path = (series: typeof result.series[number]) => Array.from({ length: 901 }, (_, i) => `${i ? 'L' : 'M'}${25 + i / 900 * 550},${95 - series.fn(i / 900) * 65 / series.range}`).join(' ');
  const spectrum = result.spectrum;
  return <section className={styles.canvas} aria-label="CAM concept canvas">
    <header><span className="eyebrow">EXPLORE THE CONCEPT · DRAFT</span><h2>{artifact.scene.title}</h2><p>{artifact.scene.visualBrief.description}</p></header>
    {result.series.map(series => <figure key={series.label}><figcaption>{series.label}</figcaption><svg viewBox="0 0 600 180" role="img" aria-label={series.label}><path d="M25 25V165M25 95H575" className={styles.axes} /><path d={path(series)} className={styles.trace} /></svg></figure>)}
    {result.flow && <figure><figcaption>Message and carrier independently enter the modulator; its output goes to the receiver.</figcaption><svg viewBox="0 0 600 245" role="img" aria-label="Message and carrier branches join at the modulator, then feed receiver recovery"><path d="M160 55H195L230 100M160 190H195L230 140M370 120H430" className={styles.axes} />{[[20,20,140,70],[20,155,140,70],[240,85,130,70],[440,85,140,70]].map(([x,y,w,h],i) => <g key={i}><rect x={x} y={y} width={w} height={h} rx="8" className={result.flow!.active === i ? styles.band : styles.axes} /><text x={x+w/2} y={y+h/2+5} textAnchor="middle">{result.flow!.labels[i].split(':')[0].split(' / ')[0]}</text></g>)}</svg></figure>}
    {result.flow && <ul className={styles.flow} aria-label="Signal flow">{result.flow.labels.map((label, i) => <li key={label} aria-current={result.flow!.active === i ? 'step' : undefined}>{label}</li>)}</ul>}
    {spectrum && <figure><figcaption>{Array.isArray(spectrum) ? 'Ideal single-tone sidebands; carrier reference is not a spectral line' : 'Schematic transmitted sidebands and vestige'}</figcaption><svg viewBox="0 0 600 210" role="img" aria-label="Sideband spectrum"><path d="M40 145H570" className={styles.axes} />{Array.isArray(spectrum) ? <>{spectrum.map(s => { const x = 50 + (s.f - 1700) / 600 * 500; return <g key={s.f}><path d={`M${x} 145V45`} className={styles.trace} /><text x={x} y="30" textAnchor="middle">{s.label}</text></g>; })}<circle cx="300" cy="145" r="5" fill="white" stroke="currentColor" /><text x="300" y="190" textAnchor="middle">2000 Hz carrier reference</text></> : <>{(spectrum.family === 0 ? [[80, 300], [300, 520]] : spectrum.family === 1 ? [[300, 520]] : [[255, 300], [300, 520]]).map(([a, b]) => <rect key={a} x={a} y="60" width={b - a} height="85" className={styles.band} />)}<text x="300" y="195" textAnchor="middle">Frequency relative to carrier (schematic)</text></>}</svg></figure>}
    <dl className={styles.readouts}>{result.readouts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><output>{value}</output></dd></div>)}</dl>
    <fieldset><legend>Explore model parameters</legend>{artifact.scene.controls.map(c => <label key={c.name} htmlFor={`${id}-${c.name}`}>{c.label}: <strong>{input[c.name]} {c.unit}</strong><input id={`${id}-${c.name}`} type="range" min={c.min} max={c.max} step={c.step} value={input[c.name]} onChange={e => setInput(old => ({ ...old, [c.name]: Number(e.target.value) }))} /></label>)}<button type="button" className="button button-secondary" onClick={() => setInput(Models.defaults(artifact.scene))}>Reset model</button></fieldset>
    {result.notes.map(note => <p role="note" key={note}>{note}</p>)}
    {artifact.scene.kind === 'signal' && <p role="note">Saved-model limit: two traces are drawn (signal and reference); the authored brief describes three.</p>}
    {artifact.scene.kind === 'dsb' && <p role="note">Saved-model limit: the carrier is fixed at 2000 Hz; the authored interaction also describes an adjustable carrier.</p>}
    <p>Manual exploration only. No sentence alignment, lab control, saved progress or assessed proficiency is implied.</p>
    <details><summary>Sources and model review · scientific review {artifact.review.scientific}</summary><p>{artifact.scene.visualBrief.alt}</p><ul>{artifact.sources.map((source, i) => <li key={i}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</li>)}</ul>{artifact.scene.assumptions.map(note => <p key={note}>{note}</p>)}</details>
  </section>;
}
