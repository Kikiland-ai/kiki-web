const Models = (() => {
'use strict';
  const TAU=2*Math.PI, sin=Math.sin, cos=Math.cos;
  const finite=x=>{if(!Number.isFinite(x))throw new Error('Nonfinite model parameter');return x;};
  function defaults(scene){return Object.fromEntries(scene.controls.map(c=>[c.name,c.default]));}
  function values(scene,input){const out={};for(const c of scene.controls){const n=finite(Number(input[c.name]??c.default));if(n<c.min||n>c.max||Math.abs((n-c.min)/c.step-Math.round((n-c.min)/c.step))>1e-6)throw new Error('Parameter outside declared bounds or step');out[c.name]=n;}return out;}
  function butterworth(f,cutoff){const r=f/cutoff;return {gain:1/Math.sqrt(1+r**4),phase:-Math.atan2(Math.SQRT2*r,1-r*r)};}
  function model(scene,input){const v=values(scene,input), kind=scene.kind, time=.02, t=x=>x*time;
    const series=[],readouts=[],notes=[];let spectrum=null,flow=null;
    const add=(label,fn,range=1.2)=>series.push({label,fn,range});
    switch(kind){
    case 'signal':
      add('Signal',x=>v.amplitude*sin(TAU*v.frequency*t(x)+v.phase*Math.PI/180),2.2);
      add('Reference: unit amplitude and zero phase',x=>sin(TAU*v.frequency*t(x)),2.2);
      readouts.push(['Period',(1000/v.frequency).toFixed(3)+' ms'],['Angular frequency',(TAU*v.frequency).toFixed(2)+' rad/s'],['Frequency',v.frequency+' Hz']);
      notes.push('Changing amplitude leaves period unchanged. Phase is relative to the reference. Time window: 20 ms.');break;
    case 'flow':
      flow={labels:['Message: information','Carrier: reference','Modulator','Receiver / recovery'],active:v.stage};
      readouts.push(['Selected stage',flow.labels[v.stage]]);notes.push('Follow information through the chain. This is a teaching flow, not a working transmitter.');break;
    case 'am':
      add('Conventional AM output',x=>(1+v.mu*cos(TAU*100*t(x)))*cos(TAU*2000*t(x)),2.7);
      add('Signed envelope factor',x=>1+v.mu*cos(TAU*100*t(x)),2.7);
      readouts.push(['Modulation index',v.mu.toFixed(2)],['Envelope minimum',(1-v.mu).toFixed(2)],['Envelope detection',v.mu<=1?'Non-negative envelope':'Overmodulation: signed envelope crosses zero']);
      notes.push('Normalized carrier amplitude. Message/carrier illustration uses 100/2000 Hz. A suitable detector time constant is still required.');break;
    case 'dsb':
      add('Message',x=>sin(TAU*v.fm*t(x)));
      add('DSB-SC product',x=>sin(TAU*v.fm*t(x))*cos(TAU*2000*t(x)));
      spectrum=[{f:2000-v.fm,label:(2000-v.fm)+' Hz'},{f:2000+v.fm,label:(2000+v.fm)+' Hz'}];
      readouts.push(['Lower sideband',(2000-v.fm)+' Hz'],['Upper sideband',(2000+v.fm)+' Hz'],['Separate carrier line','Absent for this ideal zero-mean message']);notes.push('Carrier 2000 Hz. Signed product; no intentional DC offset. Time window: 20 ms.');break;
    case 'spectrum':
      spectrum={family:v.family};readouts.push(['Family',['DSB-SC','SSB (upper shown)','VSB'][v.family]],['Bandwidth',['2B','B','Between B and 2B'][v.family]]);notes.push('Schematic positive-frequency bands relative to the carrier. Vestige width is illustrative, not a specified filter.');break;
    case 'receiver':{
      const m=x=>sin(TAU*100*t(x)), carrier=x=>cos(TAU*2000*t(x));
      add('Original message',m);
      const functions=[x=>m(x)*carrier(x),x=>m(x)*carrier(x)**2,x=>m(x)/2,m];
      add(['Received DSB-SC','Product with matched local carrier','Ideal lowpass output','After gain 2'][v.stage],functions[v.stage]);
      readouts.push(['Stage',['Received DSB-SC','Multiply by local carrier','Ideal lowpass','Recovery gain 2'][v.stage]],['Ideal message-band scale',v.stage<2?'Inspect the next stage':v.stage===2?'0.5':'1']);notes.push('Unit carriers matched in frequency and phase. Lowpass step is idealized; practical filter effects are taught separately.');break;}
    case 'filter':{
      const h=butterworth(100,v.cutoff);add('Original message',x=>sin(TAU*100*t(x)));
      add('Steady-state recovered message component',x=>h.gain*sin(TAU*100*t(x)+h.phase));
      readouts.push(['100 Hz gain',h.gain.toFixed(5)],['100 Hz phase lag',(h.phase*180/Math.PI).toFixed(2)+'°'],['3900 Hz gain',butterworth(3900,v.cutoff).gain.toFixed(5)],['4100 Hz gain',butterworth(4100,v.cutoff).gain.toFixed(5)]);
      notes.push('Second-order Butterworth response. Source baseline cutoff: 500 Hz. The plot isolates the message component; residual high-frequency components are nonzero. Startup transient is not simulated.');break;}
    case 'phase_recovery':{
      const fraction=cos(v.phase*Math.PI/180);add('Original message',x=>sin(TAU*100*t(x)));
      add('Ideal gain-corrected recovered message',x=>fraction*sin(TAU*100*t(x)));
      readouts.push(['Signed recovery fraction',fraction.toFixed(4)],['Relative phase error',v.phase+'°']);notes.push('Equal frequencies and unit carriers; recovery gain corrected. 60° gives half amplitude; 90° suppresses the ideal message component. A finite filter may leave ripple.');break;}
    case 'fm':{
      const beta=v.df/v.B;add('Single-tone message (normalized time)',x=>cos(TAU*x));
      add('FM: constant amplitude, changing cycle spacing',x=>sin(TAU*30*x+beta*sin(TAU*x)));
      readouts.push(['Single-tone index β',beta.toFixed(3)],['Carson bandwidth estimate',(2*(v.df+v.B))+' Hz'],['Output amplitude','1 (normalized)']);
      notes.push('B equals the single-tone message frequency in this example. Carson bandwidth is an approximation. Waveform uses 30 normalized carrier cycles/window; it is not a lab carrier setting.');break;}
    case 'pm':{
      const m=x=>v.constant?1:sin(TAU*x), integral=x=>v.constant?x:(1-cos(TAU*x))/TAU;
      add('Message',m);add('PM: phase follows message',x=>sin(TAU*8*x+v.sensitivity*m(x)));
      add('FM: phase integrates message',x=>sin(TAU*8*x+v.sensitivity*integral(x)));
      readouts.push(['Message',v.constant?'Constant':'Sinusoidal'],['PM steady frequency with constant message','Returns to carrier'],['Amplitude','1 (normalized)']);notes.push('Normalized comparison; sensitivity units differ for FM and PM. Constant PM message produces a fixed phase shift; constant FM message produces a sustained frequency offset.');break;}
    default:throw new Error('Unsupported mechanism');
    }
    return {values:v,series,readouts,notes,spectrum,flow};
  }
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
  function svg(body,label,height=210){return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+esc(label)+'" viewBox="0 0 600 '+height+'">'+body+'</svg>';}
  function waveform(series,cursor){const n=900,w=550,left=25,mid=95,scale=65/series.range;const points=[];
    for(let i=0;i<=n;i++){const x=i/n,y=finite(series.fn(x));points.push((left+w*x).toFixed(2)+','+(mid-scale*y).toFixed(2));}
    const cx=left+w*cursor,cy=mid-scale*finite(series.fn(cursor));
    return svg('<path d="M25 25V165M25 95H575" fill="none" stroke="#b8bdb9"/><polyline points="'+points.join(' ')+'" fill="none" stroke="#18794e" stroke-width="1.7"/><path d="M'+cx+' 25V165" stroke="#606b65" stroke-dasharray="5 5"/><circle cx="'+cx+'" cy="'+cy+'" r="4" fill="#17251d"/>',series.label,180);
  }
  function spectrumSvg(value){if(Array.isArray(value)){const x=f=>50+(f-1700)/600*500;return svg('<path d="M40 145H570" stroke="#88968c"/>'+value.map(s=>'<path d="M'+x(s.f)+' 145V45" stroke="#18794e" stroke-width="5"/><text x="'+x(s.f)+'" y="30" text-anchor="middle" font-size="24">'+esc(s.label)+'</text>').join('')+'<circle cx="'+x(2000)+'" cy="145" r="5" fill="white" stroke="#17251d"/><text x="'+x(2000)+'" y="185" text-anchor="middle" font-size="21">carrier reference</text>','Ideal sidebands; hollow carrier reference is not a spectral line');}
    const family=value.family,bands=family===0?[[80,300],[300,520]]:family===1?[[300,520]]:[[255,300],[300,520]];
    return svg('<path d="M45 145H555M300 45V160" stroke="#88968c"/>'+bands.map(([a,b])=>'<rect x="'+a+'" y="60" width="'+(b-a)+'" height="85" fill="#d8efe2" stroke="#18794e"/>').join('')+'<text x="300" y="195" text-anchor="middle" font-size="22">frequency relative to carrier (schematic)</text>','Compare transmitted sidebands and vestige');
  }
  function flowSvg(flow){const boxes=[[20,20,140,70],[20,155,140,70],[240,85,130,70],[440,85,140,70]];return svg('<path d="M160 55H195L230 100m-8-1 8 1-2-8M160 190H195L230 140m-8 1 8-1-2 8M370 120H430m-8-6 8 6-8 6" fill="none" stroke="#17251d" stroke-width="2"/>'+boxes.map(([x,y,w,h],i)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="9" fill="'+(flow.active===i?'#d8efe2':'#f6f8f6')+'" stroke="#18794e"/><text x="'+(x+w/2)+'" y="'+(y+h/2+5)+'" text-anchor="middle" font-size="18">'+esc(flow.labels[i].split(':')[0].split(' / ')[0])+'</text>').join(''),'Message and carrier independently enter the modulator; output goes to receiver',245);}
  function render(scene,input,cursor=.25){finite(cursor);if(cursor<0||cursor>1)throw new Error('Cursor outside window');const m=model(scene,input);if(scene.kind==='fm')m.readouts.push(['Instantaneous frequency (normalized)',(30+(m.values.df/m.values.B)*cos(TAU*cursor)).toFixed(3)+' cycles/window']);if(scene.kind==='pm'){const v=m.values,msg=v.constant?1:sin(TAU*cursor);m.readouts.push(['PM instantaneous frequency (normalized)',(8+(v.constant?0:v.sensitivity*cos(TAU*cursor))).toFixed(3)],['FM instantaneous frequency (normalized)',(8+v.sensitivity*msg/TAU).toFixed(3)]);}return {...m,plots:m.series.map(s=>({label:s.label,svg:waveform(s,cursor)})),extraSvg:m.spectrum?spectrumSvg(m.spectrum):m.flow?flowSvg(m.flow):null};}
  return {defaults,values,model,render,butterworth};

})();
export default Models;
