import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useNavigate,useParams} from 'react-router';
import {useSession} from '../../../app/Session';
import type {PhysicalLabApi,PhysicalSession,PhysicalPack,PhysicalPart,PhysicalObservations,PhysicalEvent} from '../../../contracts/physical-lab';
import {ActionLink,Alert,Button,KikiDots,LoadingNotice,PageTitle} from '../../../ui/kit';
import {readableError,ServiceError} from '../../../services/types';
import {ApparatusViewer,clampPanel,guidePosition} from './apparatus-viewer.mjs';
import {componentHint,tooltipPosition} from './component-hints.mjs';
import './physical-lab.css';

export function PhysicalLab(){
  const {services,profile}=useSession(),{sessionId}=useParams(),navigate=useNavigate();
  if(!services.physicalLabs)return <div className="page-stack"><PageTitle title="Physical Lab"/><p>Open the connected Kiki app to practise with your college equipment.</p><ActionLink to="/labs">Back to Lab mode</ActionLink></div>;
  return <PhysicalExperiment key={`${profile?.id}:${sessionId||'new'}`} api={services.physicalLabs} sessionId={sessionId} language={profile?.supportLanguage==='or'?'or':'en'} onSession={id=>navigate(`/labs/physical/${id}`,{replace:true})} registerCleanup={services.auth.registerSignOutCleanup}/>;
}

type Props={api:PhysicalLabApi;sessionId?:string;language:'en'|'or';onSession(id:string):void;registerCleanup?:(cleanup:()=>void)=>()=>void};
type Loaded={session:PhysicalSession;pack:PhysicalPack;gltf:unknown};
type Hint={part:PhysicalPart;x:number;y:number};
const label=(pack:PhysicalPack,id?:string|null)=>pack.parts.find(p=>p.id===id)?.label||id||'';

/** Student presentation lives here; the remote experiment pipeline owns every checkpoint. */
export function PhysicalExperiment({api,sessionId,language,onSession,registerCleanup}:Props){
  const [loaded,setLoaded]=useState<Loaded|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0),[starting,setStarting]=useState(false),[recent,setRecent]=useState<string|null>(null);
  const lifecycle=useRef<AbortController|null>(null),creationKey=useRef(crypto.randomUUID());
  useEffect(()=>{
    const abort=new AbortController();lifecycle.current=abort;setLoaded(null);setError('');
    const unregister=registerCleanup?.(()=>abort.abort());
    if(!sessionId)void api.sessions(abort.signal).then(rows=>{if(!abort.signal.aborted)setRecent(rows.find(s=>s.experiment_id==='dsb-sc-trainer'&&s.mode==='experiment_demo')?.session_id??null);}).catch(e=>{if(!abort.signal.aborted)setError(readableError(e));});
    if(sessionId)void(async()=>{
      try{const session=await api.get(sessionId,abort.signal);if(session.mode!=='experiment_demo')throw new ServiceError('Open this preparation in its original mode.');const pack=await api.pack(sessionId,abort.signal);if(pack.id!==session.experiment_id||pack.version!==session.pack_version)throw new ServiceError('This apparatus does not match the saved experiment.');const gltf=await api.asset(pack,abort.signal);if(!abort.signal.aborted)setLoaded({session,pack,gltf});}
      catch(e){if(!abort.signal.aborted)setError(readableError(e));}
    })();
    return()=>{abort.abort();unregister?.();};
  },[api,sessionId,reload,registerCleanup]);
  async function start(){setStarting(true);setError('');const signal=lifecycle.current!.signal;try{const session=await api.create('dsb-sc-trainer',language,creationKey.current,signal);if(!signal.aborted)onSession(session.session_id);}catch(e){if(!signal.aborted)setError(readableError(e));}finally{if(!signal.aborted)setStarting(false);}}
  return <div className="page-stack physical-lab"><ActionLink variant="text" to="/labs">Back to Lab mode</ActionLink><PageTitle eyebrow="PHYSICAL LAB · VIRTUAL PRACTICE" title={loaded?.pack.title||'DSB-SC trainer experiment'}>Connect the trainer. Kiki checks each step. See the outputs as you build.</PageTitle>
    {error&&<Alert>{error}{sessionId&&<Button variant="text" onClick={()=>setReload(n=>n+1)}>Reload saved experiment</Button>}</Alert>}
    {!sessionId?<div className="card"><h2>Explore your college trainer</h2><p>Practise identifying the sockets, connecting leads and reading the recovered signal before attending the physical lab. This demo assumes you already know the prerequisite theory.</p><Button disabled={starting} onClick={()=>void start()}>{starting?'Opening experiment…':'Start experiment'}</Button>{recent&&<Button variant="secondary" disabled={starting} onClick={()=>onSession(recent)}>Resume physical experiment</Button>}</div>:loaded?<ExperimentWorkspace key={loaded.session.session_id+':'+reload} api={api} initial={loaded} registerCleanup={registerCleanup}/>:!error&&<LoadingNotice>Opening your saved experiment…</LoadingNotice>}
    <p className="helper-note">Virtual practice · Ideal signal model · Physical handling and power-on checks stay with your college instructor. Content and Odia review pending.</p>
  </div>;
}

function ExperimentWorkspace({api,initial,registerCleanup}:{api:PhysicalLabApi;initial:Loaded;registerCleanup?:Props['registerCleanup']}){
  const {pack,gltf}=initial;
  const [session,setSession]=useState(initial.session),[observation,setObservation]=useState<PhysicalObservations|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState<string|null>(null),[selected,setSelected]=useState<string|null>(null),[hint,setHint]=useState<Hint|null>(null),[collapsed,setCollapsed]=useState(false),[fullscreen,setFullscreen]=useState(false),[markers,setMarkers]=useState(true),[setting,setSetting]=useState<number|string|boolean>(0),[reading,setReading]=useState(''),[failed,setFailed]=useState(false),[saved,setSaved]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null),workspace=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),guide=useRef<HTMLElement>(null),tip=useRef<HTMLDivElement>(null),viewer=useRef<ApparatusViewer|null>(null),buttons=useRef(new Map<string,HTMLButtonElement>());
  const current=useRef(session),selectedRef=useRef(selected),pendingRef=useRef(pending),pinned=useRef(false),drag=useRef<{x:number;y:number;left:number;top:number}|null>(null),queue=useRef(Promise.resolve()),aborted=useRef<AbortController|null>(null),pick=useRef<(p:PhysicalPart)=>void>(()=>{}),showMarkers=useRef(markers);
  const failedAction=useRef<PhysicalEvent|null>(null),blocked=useRef(false),observationRevision=useRef(-1),lastStep=useRef<string|null>(null);
  const rule=session.activity.step?.rule;
  const refreshObservations=useCallback(async(s:PhysicalSession,signal:AbortSignal)=>{const value=await api.observations(s.session_id,signal);if(!signal.aborted&&s.revision>=observationRevision.current){observationRevision.current=s.revision;setObservation(value);}},[api]);
  useEffect(()=>{const controller=new AbortController();aborted.current=controller;const unregister=registerCleanup?.(()=>controller.abort());void refreshObservations(initial.session,controller.signal).catch(e=>{if(!controller.signal.aborted)setError(readableError(e));});return()=>{controller.abort();unregister?.();};},[initial.session,refreshObservations,registerCleanup]);
  async function perform(body:PhysicalEvent){
    const signal=aborted.current!.signal;setBusy(true);setError('');
    try{const next=await api.event(current.current.session_id,body,signal);if(signal.aborted)return;current.current=next;setSession(next);failedAction.current=null;blocked.current=false;setFailed(false);setSaved(true);await refreshObservations(next,signal);}
    catch(e){if(!signal.aborted){setError(readableError(e));if(current.current.revision===body.revision){failedAction.current=body;blocked.current=true;setFailed(true);}}}
    finally{if(!signal.aborted)setBusy(false);}
  }
  function action(fields:Omit<PhysicalEvent,'event_id'|'revision'>){
    if(blocked.current||aborted.current?.signal.aborted)return;
    const event_id=crypto.randomUUID();
    queue.current=queue.current.then(async()=>{if(blocked.current||aborted.current?.signal.aborted)return;await perform({...fields,event_id,revision:current.current.revision});});
  }
  function choose(part:PhysicalPart){setSelected(part.id);selectedRef.current=part.id;
    const active=current.current.activity.step?.rule;if(!active||blocked.current)return;
    if(active.kind==='connect'){
      if(part.kind==='output'){pendingRef.current=part.id;setPending(part.id);}
      else if(part.kind==='input'&&pendingRef.current){const source=pendingRef.current;pendingRef.current=null;setPending(null);action({kind:'connect',target:source,other:part.id});}
    }else if(active.kind==='select')action({kind:'select',target:part.id});
  }
  useLayoutEffect(()=>{pick.current=choose;});
  useEffect(()=>{
    const element=canvas.current!;
    const view=new ApparatusViewer(element,{onPick:part=>pick.current(part),onHover:(part,event)=>setHint(part?{part,x:event.clientX,y:event.clientY}:null),onFrame:points=>{
      for(const item of points){const b=buttons.current.get(item.id);if(b){b.style.left=`${item.point[0]+16}px`;b.style.top=`${item.point[1]-15}px`;b.hidden=!showMarkers.current||item.point[0]<0||item.point[0]>element.clientWidth||item.point[1]<0||item.point[1]>element.clientHeight;}}
      const g=guide.current,v=viewport.current,r=current.current.activity.step?.rule;
      if(g&&v&&r&&!pinned.current&&!drag.current){const rect=g.getBoundingClientRect(),vr=v.getBoundingClientRect(),targets=points.filter(p=>p.id===r.target||p.id===r.other).map(p=>[p.point[0]+16,p.point[1]-15] as [number,number]);const [x,y]=guidePosition(targets,v.clientWidth,v.clientHeight,g.offsetWidth,g.offsetHeight,[rect.left-vr.left,rect.top-vr.top]);g.style.left=`${x}px`;g.style.top=`${y}px`;g.style.right='auto';}
    }});
    viewer.current=view;view.load(gltf,pack);
    return()=>{view.destroy();viewer.current=null;};
  },[gltf,pack]);
  useEffect(()=>{showMarkers.current=markers;viewer.current?.schedule();},[markers]);
  useEffect(()=>{
    const active=session.activity.step?.rule;
    viewer.current?.update({selected,controls:session.apparatus.controls,connections:session.apparatus.connections,pending,targets:active?[active.target,active.other].filter((x):x is string=>Boolean(x)):[],observation});
  },[session,selected,pending,observation]);
  useEffect(()=>{const stepId=session.activity.step?.id??'complete';if(lastStep.current===stepId)return;lastStep.current=stepId;setHint(null);setPending(null);pendingRef.current=null;const r=session.activity.step?.rule;if(r){setSetting(session.apparatus.controls[r.target]??0);setReading(r.kind==='measure'?String(observation?.readings[r.other||'']??''):'');viewer.current?.view(r.kind==='measure'?'scope':r.target.startsWith('scope.')||r.other?.startsWith('scope.')?'all':'trainer');}},[session,observation]); // Camera changes only when the saved step changes.
  useEffect(()=>{
    const controller=new AbortController(),signal=controller.signal;
    document.addEventListener('fullscreenchange',()=>{setFullscreen(document.fullscreenElement===workspace.current);setHint(null);viewer.current?.schedule();},{signal});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){setFullscreen(false);setHint(null);}},{signal});
    window.addEventListener('scroll',()=>setHint(null),{capture:true,signal});
    return()=>controller.abort();
  },[]);
  useLayoutEffect(()=>{
    if(!hint||!tip.current||!viewport.current)return;
    const r=viewport.current.getBoundingClientRect(),left=Math.max(0,-r.left),top=Math.max(0,-r.top),width=Math.min(r.width,innerWidth-r.left)-left,height=Math.min(r.height,innerHeight-r.top)-top;
    const t=tip.current;t.style.maxWidth=`${Math.max(0,Math.min(290,width-16))}px`;
    const [x,y]=tooltipPosition(hint.x-r.left-left,hint.y-r.top-top,width,height,t.offsetWidth,t.offsetHeight);t.style.left=`${x+left}px`;t.style.top=`${y+top}px`;
  },[hint,pending,session]);
  function positionGuide(x:number,y:number){const v=viewport.current!,g=guide.current!,point=clampPanel(x,y,v.clientWidth,v.clientHeight,g.offsetWidth,g.offsetHeight);g.style.left=`${point[0]}px`;g.style.top=`${point[1]}px`;g.style.right='auto';}
  async function toggleFullscreen(){setHint(null);try{if(document.fullscreenElement===workspace.current)await document.exitFullscreen();else if(fullscreen)setFullscreen(false);else if(workspace.current?.requestFullscreen)await workspace.current.requestFullscreen();else setFullscreen(true);}catch{setFullscreen(v=>!v);}viewer.current?.schedule();}
  const hintText=hint?componentHint(hint.part,pack.parts,rule,pending,session.activity.number):null;
  const complete=session.stage==='experiment_complete',control=rule?pack.controls[rule.target]:null;
  const feedback=session.feedback?.passed===false?'That action needs another try. Check the component names and connection.':session.feedback?.passed?'Step checked. Continue with the next action.':pending?`${label(pack,pending)} selected. Choose the destination input socket.`:'Select the output socket, then the input socket. Kiki checks the lead.';
  return <>
    <div role="status" className="physical-save">{busy?'Saving and checking…':saved?'Progress saved':'Saved experiment'} · Virtual practice</div>
    <div ref={workspace} className={`physical-workspace${fullscreen?' physical-expanded':''}`}>
      <div className="physical-toolbar"><strong>Balanced modulator & synchronous detector</strong><div>{[['all','Full setup'],['trainer','Trainer'],['scope','CRO'],['top','Top view']].map(([id,name])=><Button key={id} variant="secondary" onClick={()=>{setHint(null);viewer.current?.view(id);}}>{name}</Button>)}</div></div>
      <div className="physical-viewport" ref={viewport} onPointerLeave={()=>setHint(null)}>
        <canvas ref={canvas} aria-label="Interactive 3D trainer. Drag empty space to rotate; scroll to zoom."/>
        <div className="physical-markers">{pack.parts.filter(p=>p.kind!=='body').map((part,i)=><button key={part.id} ref={el=>{if(el)buttons.current.set(part.id,el);else buttons.current.delete(part.id);}} className={`physical-marker${selected===part.id?' selected':''}${rule&&(part.id===rule.target||part.id===rule.other)?' required':''}`} aria-label={`${part.label} on instrument`} onClick={()=>choose(part)} onPointerEnter={e=>setHint({part,x:e.clientX,y:e.clientY})} onPointerMove={e=>setHint({part,x:e.clientX,y:e.clientY})} onPointerLeave={()=>setHint(null)} onFocus={e=>{const r=e.currentTarget.getBoundingClientRect();setHint({part,x:r.right,y:r.top});}} onBlur={()=>setHint(null)} aria-describedby={hint?.part.id===part.id?'physical-component-tooltip':undefined}>{i+1}</button>)}</div>
        <aside className="physical-guide" ref={guide} aria-label="Kiki experiment guide"><div className="physical-guide-head"><button aria-label="Move Kiki guide" className="physical-guide-drag" onPointerDown={e=>{const g=guide.current!.getBoundingClientRect(),r=viewport.current!.getBoundingClientRect();pinned.current=true;drag.current={x:e.clientX,y:e.clientY,left:g.left-r.left,top:g.top-r.top};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=drag.current;if(d)positionGuide(d.left+e.clientX-d.x,d.top+e.clientY-d.y);}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} onKeyDown={e=>{const moves:Record<string,[number,number]>={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(e.key==='Home'){pinned.current=false;viewer.current?.schedule();}if(moves[e.key]){e.preventDefault();pinned.current=true;const g=guide.current!.getBoundingClientRect(),r=viewport.current!.getBoundingClientRect();positionGuide(g.left-r.left+moves[e.key][0],g.top-r.top+moves[e.key][1]);}}}><KikiDots size={22}/>Kiki · experiment guide <span aria-hidden="true">⠿</span></button><button aria-label={collapsed?'Expand Kiki guide':'Collapse Kiki guide'} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'+':'−'}</button></div>
          <div className="physical-guide-body" hidden={collapsed}>
            <p className="eyebrow">{complete?'EXPERIMENT COMPLETE':`STEP ${session.activity.number} OF ${session.activity.total}`}</p><h2>{complete?'Your message has been recovered':session.activity.step?.instruction.en}</h2>
            {rule?.kind==='connect'&&<div className="physical-route"><strong>{label(pack,rule.target)}</strong><span>→</span><strong>{label(pack,rule.other)}</strong></div>}
            <p className="physical-feedback" role="status">{busy?'Kiki is checking this action…':complete?'All connections, the null setting and output readings were checked.':feedback}</p>
            {error&&<Alert>{error}{failed&&<><Button disabled={busy} onClick={()=>{const body=failedAction.current;if(body)void perform(body);}}>Retry last action</Button><Button variant="text" disabled={busy} onClick={async()=>{try{const s=await api.get(session.session_id,aborted.current!.signal);current.current=s;setSession(s);blocked.current=false;failedAction.current=null;setFailed(false);setError('');await refreshObservations(s,aborted.current!.signal);}catch(e){setError(readableError(e));}}}>Reload saved experiment</Button></>}</Alert>}
            {rule?.kind==='set'&&control&&<form className="physical-control" onSubmit={e=>{e.preventDefault();action({kind:'set',target:rule.target,value:setting,unit:rule.unit??undefined});}}><label htmlFor="physical-setting">{label(pack,rule.target)} {control.unit}</label>{typeof control.initial==='number'?<><input aria-label="Control dial" type="range" min={control.minimum??0} max={control.maximum??1} step="0.01" value={Number(setting)} onChange={e=>setSetting(Number(e.target.value))}/><input id="physical-setting" type="number" step="any" min={control.minimum??undefined} max={control.maximum??undefined} value={Number(setting)} onChange={e=>setSetting(Number(e.target.value))}/></>:<select id="physical-setting" value={String(setting)} onChange={e=>setSetting(typeof control.initial==='boolean'?e.target.value==='true':e.target.value)}>{(typeof control.initial==='boolean'?['false','true']:control.choices).map(v=><option key={v} value={v}>{v}</option>)}</select>}<Button disabled={busy||failed}>Apply setting</Button></form>}
            {rule?.kind==='measure'&&<form className="physical-control" onSubmit={e=>{e.preventDefault();action({kind:'measure',target:rule.target,other:rule.other??undefined,value:Number(reading),unit:rule.unit??undefined});}}><label htmlFor="physical-reading">Observed value ({rule.unit})</label><input id="physical-reading" type="number" step="any" required value={reading} onChange={e=>setReading(e.target.value)}/><Button disabled={busy||failed}>Record reading</Button></form>}
            {session.activity.step&&<details><summary>Why this step?</summary><p>{session.activity.step.why[session.language]||session.activity.step.why.en}</p></details>}
            {observation&&<Outputs observation={observation}/>}
            {complete&&<p>Virtual experiment complete. Theory was assumed for this demo; physical execution will take place in your college lab.</p>}
          </div>
        </aside>
        {hintText&&<div ref={tip} id="physical-component-tooltip" role="tooltip" className="physical-tooltip"><small>{hintText.step}</small><strong>{hintText.title}</strong><span>{hintText.detail}</span><p>{hintText.cue}</p></div>}
        <Button variant="secondary" className="physical-fullscreen" aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} aria-pressed={fullscreen} onClick={()=>void toggleFullscreen()}>{fullscreen?'Exit fullscreen':'Fullscreen'}</Button>
      </div>
      <div className="physical-help"><span>Hover to identify · Output then input to connect · Drag to rotate · Scroll to zoom</span><label><input type="checkbox" checked={markers} onChange={e=>setMarkers(e.target.checked)}/> Part markers</label></div>
    </div>
  </>;
}

function Outputs({observation}:{observation:PhysicalObservations}){
  return <section className="physical-outputs" aria-label="Live virtual outputs"><p className="eyebrow">LIVE VIRTUAL OUTPUTS · 2 ms window</p><svg viewBox="0 0 320 90" role="img" aria-label="Message, DSB-SC and recovered waveforms">{(['message_v','dsb_sc_v','recovered_v'] as const).map((key,i)=><polyline key={key} fill="none" stroke={['#a9bbc0','#d0b678','#9cbd86'][i]} strokeWidth="0.7" points={observation.traces[key].map((v,n,values)=>`${n*320/Math.max(1,values.length-1)},${45-v*30}`).join(' ')}/>)}</svg><p className="physical-trace-key">Message · DSB-SC · Recovered</p><dl>{[['Message','message_frequency_hz','Hz'],['Recovered','recovered_frequency_hz','Hz'],['Peak amplitude','recovered_peak_v','V']].map(([name,key,unit])=><div key={key}><dt>{name}</dt><dd>{observation.readings[key]??'—'} {unit}</dd></div>)}</dl></section>;
}
