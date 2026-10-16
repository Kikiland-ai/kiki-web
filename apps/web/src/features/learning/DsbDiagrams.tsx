import {useState} from 'react';
import type {DsbVisual} from '../../contracts/teaching-visual';
import type {LessonTerm} from '../../contracts/api';
import {TermChip} from '../../ui/learning';
import {sampleDsb,sidebands,spectrumPosition} from './dsb-math';
import styles from './DsbDiagrams.module.css';

type Target='sidebands'|'carrier'|'signal'|null;
function Trace({kind,message,carrier}:{kind:'message'|'carrier'|'product';message:number;carrier:number}){
  const path=Array.from({length:801},(_,i)=>{const value=sampleDsb(message,carrier,i/800*0.02)[kind];return `${i===0?'M':'L'}${i/800*240},${36-value*26}`;}).join(' ');
  return <svg viewBox="0 0 240 72" className={styles.trace} aria-hidden="true"><line x1="0" x2="240" y1="36" y2="36" className={styles.zero}/><path d={path} className={kind==='product'?styles.productTrace:styles.inputTrace} fill="none"/></svg>;
}
function Spectrum({message,carrier,target,compact=false}:{message:number;carrier:number;target:Target;compact?:boolean}){
  const {lower,upper}=sidebands(message,carrier),span=250;
  const left=spectrumPosition(lower,carrier,span),right=spectrumPosition(upper,carrier,span);
  return <div className={compact?styles.compact:''}>
    <svg viewBox="0 0 600 250" className={styles.spectrum} role="img" aria-label={`Ideal positive-frequency DSB-SC spectrum: lower sideband ${lower} Hz, upper sideband ${upper} Hz. No separate carrier line at ${carrier} Hz.`}>
      <line x1="44" x2="566" y1="212" y2="212" className={styles.axis}/><path d="M558 206 L566 212 L558 218" className={styles.axis} fill="none"/>
      <line x1="44" x2="44" y1="212" y2="24" className={styles.axis}/><path d="M38 32 L44 24 L50 32" className={styles.axis} fill="none"/>
      <line x1="44" x2="556" y1="62" y2="62" className={styles.grid}/>
      {target==='sidebands'&&<g className={styles.highlight} data-testid="sideband-highlight"><rect x={left-12} y="46" width="24" height="172" rx="10"/><rect x={right-12} y="46" width="24" height="172" rx="10"/></g>}
      <g data-testid="sideband-stems" className={styles.stems}><line data-frequency-hz={lower} x1={left} x2={left} y1="212" y2="62"/><line data-frequency-hz={upper} x1={right} x2={right} y1="212" y2="62"/><circle cx={left} cy="62" r="5"/><circle cx={right} cy="62" r="5"/></g>
      <circle data-testid="carrier-reference" cx="300" cy="212" r={target==='carrier'?10:6} className={target==='carrier'?styles.selectedReference:styles.reference}/>
      {[carrier-span,carrier,carrier+span].map(hz=><line key={hz} x1={spectrumPosition(hz,carrier,span)} x2={spectrumPosition(hz,carrier,span)} y1="212" y2="220" className={styles.axis}/>)}
    </svg>
    <div className={styles.ticks} aria-hidden="true"><span>{carrier-span}</span><span>{carrier}</span><span>{carrier+span}</span></div>
    <p className={styles.axisLabel}>Frequency (Hz)</p>
    <div className={styles.readings}><div><strong>Lower sideband</strong><span>f<sub>c</sub> − f<sub>m</sub></span><b>{lower} Hz</b></div><div><strong>Carrier reference</strong><span>No separate line</span><b>{carrier} Hz</b></div><div><strong>Upper sideband</strong><span>f<sub>c</sub> + f<sub>m</sub></span><b>{upper} Hz</b></div></div>
  </div>;
}
export function DsbDiagrams({visual,terms,selectedTermId,onTermOpen}:{visual:DsbVisual;terms:LessonTerm[];selectedTermId:string|null;onTermOpen(id:string|null):void}){
  const [message,setMessage]=useState(visual.messageFrequencyHz),carrier=visual.carrierFrequencyHz;
  const target:Target=selectedTermId===visual.sidebandTermId?'sidebands':selectedTermId===visual.carrierTermId?'carrier':selectedTermId===visual.signalTermId?'signal':null;
  const {lower,upper}=sidebands(message,carrier);
  return <section className={styles.visuals} aria-label="DSB-SC teaching diagrams">
    <header><span className={styles.eyebrow}>SEE THE CONCEPT</span><h2>From two signals to two sidebands</h2><p>Ideal zero-mean, single-tone message. These are calculated teaching diagrams, not live Simulink output.</p></header>
    <figure className={styles.flowFigure}><figcaption><strong>1. How the signal is made</strong><span>Multiply the instantaneous values; do not add the signals.</span></figcaption>
      <div className={styles.flow} role="img" aria-label={`A ${message} Hz message and ${carrier} Hz carrier feed a Product multiplier to create the signed DSB-SC signal.`}>
        <div className={styles.inputs}><div className={styles.signalBox}><b>Message · m(t)</b><span>{message} Hz · zero mean</span><Trace kind="message" message={message} carrier={carrier}/></div><div className={styles.signalBox}><b>Carrier · c(t)</b><span>{carrier} Hz</span><Trace kind="carrier" message={message} carrier={carrier}/></div></div>
        <div className={styles.multiply}><span className={styles.incoming} aria-hidden="true">→</span><b aria-hidden="true">×</b><span>Product</span><span className={styles.outgoing} aria-hidden="true">→</span></div>
        <div className={`${styles.signalBox} ${target==='signal'?styles.selectedSignal:''}`}><b>DSB-SC · s(t)</b><span>m(t) × c(t)</span><Trace kind="product" message={message} carrier={carrier}/><span>Signed waveform · 0–20 ms</span></div>
      </div><p className={styles.math}>m(t) = sin(2πf<sub>m</sub>t), c(t) = cos(2πf<sub>c</sub>t) · unit amplitudes</p>
    </figure>
    <figure className={styles.spectrumFigure}><figcaption><strong>2. Where the energy appears</strong><span>Positive-frequency spectrum · relative amplitude (normalised)</span></figcaption><Spectrum message={message} carrier={carrier} target={target}/><p>The two sideband lines have equal normalised height. The hollow marker at f<sub>c</sub> is a frequency reference, not a carrier line.</p><p className={styles.takeaway}>Suppressed carrier does not mean no transmitted signal.</p></figure>
    <div className={styles.controls}><label htmlFor="dsb-message-frequency">Message frequency <strong>{message} Hz</strong></label><input id="dsb-message-frequency" type="range" min={visual.messageRangeHz.min} max={visual.messageRangeHz.max} step={visual.messageRangeHz.step} value={message} onChange={e=>setMessage(Number(e.target.value))} aria-describedby="dsb-frequency-help"/><p id="dsb-frequency-help">Try a different message frequency. The carrier stays at {carrier} Hz.</p><p role="status">Lower sideband: {lower} Hz · Upper sideband: {upper} Hz</p><button type="button" className={styles.reset} onClick={()=>setMessage(visual.messageFrequencyHz)}>Reset to lesson example</button><p className={styles.note}>Exploration only. This does not change your lab settings, saved lesson place or check results.</p></div>
    <div className={styles.terms}><p><strong>Connect a word to the diagram</strong> · Open its meaning, then close the sheet to compare the highlight.</p><div className={styles.termButtons}>{[visual.sidebandTermId,visual.carrierTermId,visual.signalTermId].map(id=>{const term=terms.find(t=>t.id===id)!;return <TermChip key={id} term={term} onOpen={onTermOpen} detailsContext={<div className={styles.sheetContext}><p><strong>In this diagram</strong></p>{id===visual.signalTermId?<><Trace kind="product" message={message} carrier={carrier}/><p>DSB-SC is the signed Product output.</p></>:<Spectrum compact message={message} carrier={carrier} target={id===visual.sidebandTermId?'sidebands':'carrier'}/>}</div>}/>;})}{target&&<button className={styles.reset} type="button" onClick={()=>onTermOpen(null)}>Clear diagram highlight</button>}</div><p className={styles.note}>{target==='sidebands'?'Highlighted: both sideband lines.':target==='carrier'?'Highlighted: the carrier reference; its separate spectral line is absent.':target==='signal'?'Highlighted: the DSB-SC Product output.':'Select sideband, carrier or DSB-SC to locate it.'}</p></div>
    <details className={styles.sources}><summary>Diagram sources · Draft teaching content</summary><ul>{visual.sources.map((s,i)=><li key={i}>{s.url?<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>:s.label}</li>)}</ul></details>
  </section>;
}
