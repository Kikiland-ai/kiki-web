import {LabConnection} from './LabConnection';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {useBlocker,useNavigate,useParams} from 'react-router';
import {useSession} from '../../app/Session';
import {COURSE} from '../../contracts/profile';
import {ASSESSMENT_CONCEPTS} from '../../contracts/assessment-catalog';
import type {LabPreparation,Practical,PreparationFields} from '../../contracts/lab-preparation';
import type {LabReadiness} from '../../contracts/api';
import {ServiceError,readableError} from '../../services/types';
import {ActionLink,Alert,Button,Card,LoadingNotice,PageTitle} from '../../ui/kit';
import {pick} from '../learning/language';
import styles from './LabPreparation.module.css';
import {DEFAULT_MODEL_NAME,MODEL_FOLDER,modelName,modelNameError} from './model-name';

function MonitoringNotice(){return <aside className={styles.notice} aria-label="Monitoring status"><strong>Screen guidance is off in this preview</strong><p>You can read the steps and save notes. Nothing here is checked.</p></aside>;}
function Readiness({value}:{value:LabReadiness}){return <section aria-labelledby="lab-readiness"><h2 id="lab-readiness">Theory this lab uses</h2><p><strong>{7-value.missingConceptIds.length} of 7 passed</strong> · {value.ready?'All set.':'Not required to start. These checks explain what you are building.'}</p><ul className={styles.required}>{ASSESSMENT_CONCEPTS.filter(c=>c.requiredForLab).map(c=><li key={c.id}><ActionLink variant="text" to={`/concepts/${c.id}`}>{c.title}</ActionLink><span>{value.missingConceptIds.includes(c.id)?'Check pending':'Check passed'}</span></li>)}</ul></section>;}
function Enrollment(){return <div className="page-stack"><PageTitle title="Lab mode"/><p>Add Analog Communication to open its lab preparation.</p><ActionLink to="/subjects">Add your subject</ActionLink></div>;}
export function LabHome(){
  const {services,profile}=useSession(),navigate=useNavigate(),uid=profile?.id;
  const [load,setLoad]=useState<{practical:Practical;active:LabPreparation|null;readiness:LabReadiness}|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false);
  const operation=useRef<AbortController|null>(null);
  const enrolled=profile?.courseIds.includes(COURSE.id);
  useEffect(()=>{if(!enrolled)return;const controller=new AbortController();setLoad(null);setError('');Promise.all([services.labPreparation.practical(controller.signal),services.labPreparation.active(controller.signal),services.learning.getProgress(COURSE.chapterId,controller.signal)]).then(([practical,active,progress])=>{if(controller.signal.aborted)return;if(progress.ownerLearnerId!==uid||active&&active.ownerLearnerId!==uid)throw new ServiceError('The lab preparation does not match your account.');setLoad({practical,active,readiness:active?.readiness??progress.labReadiness!});}).catch(e=>{if(!controller.signal.aborted)setError(readableError(e));});return()=>{controller.abort();operation.current?.abort();};},[enrolled,services,uid,reload]);
  async function start(){const controller=new AbortController();operation.current=controller;setBusy(true);setError('');try{const session=await services.labPreparation.start(controller.signal);if(controller.signal.aborted)return;if(session.ownerLearnerId!==uid)throw new ServiceError('The session does not match your account.');navigate(session.sessionPath);}catch(e){if(!controller.signal.aborted)setError(readableError(e));}finally{if(!controller.signal.aborted)setBusy(false);}}
  if(!enrolled)return <Enrollment/>;
  return <div className={`page-stack ${styles.screen}`}><PageTitle eyebrow="PRACTICAL · ANALOG MODULATION" title="Lab mode">Build the experiment yourself in Simulink Online. Kiki shows you one step at a time.</PageTitle>{!services.labExecution&&<MonitoringNotice/>}{services.mode==='fixture'&&<p className="helper-note">Sample preparation · Saved in this browser only.</p>}{error&&<Alert>{error}<Button variant="text" onClick={()=>load?start():setReload(n=>n+1)}>Retry</Button></Alert>}{!load&&!error&&<LoadingNotice>Opening Lab mode…</LoadingNotice>}{load&&<div className={styles.landing}><Card><span className="dimension-label lab-text">SIMULATION · {load.practical.softwareName}</span><h2>{load.practical.title}</h2><p>{load.practical.aim}</p><ol className={styles.howItWorks}><li>Save a blank Simulink model as <code>{DEFAULT_MODEL_NAME}.slx</code>.</li>{services.labExecution?<><li>Share that MATLAB tab with Kiki.</li><li>Follow the <strong>Now</strong> step until all 12 steps are done.</li></>:<li>Read the 12 steps and plan your notes.</li>}</ol><Button disabled={busy} onClick={start}>{busy?'Opening the lab…':load.active?'Resume lab preparation':'Start lab preparation'}</Button></Card><Card><Readiness value={load.readiness}/></Card></div>}</div>;
}
const fields=(s:LabPreparation):PreparationFields=>({currentCheckpointId:s.currentCheckpointId,prediction:s.prediction,projectRef:s.projectRef,observationNotes:s.observationNotes});
export function LabTracker(){
  const {sessionId=''}=useParams(),{services,profile}=useSession(),uid=profile?.id;
  const [saved,setSaved]=useState<LabPreparation|null>(null),[draft,setDraft]=useState<PreparationFields|null>(null),[remote,setRemote]=useState<LabPreparation|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(''),[retry,setRetry]=useState(0),[justSaved,setJustSaved]=useState(false),[linkedName,setLinkedName]=useState<string|null>(null);
  const onModelName=useCallback((name:string)=>setLinkedName(name),[]);
  const operation=useRef<AbortController|null>(null);
  const dirty=Boolean(saved&&draft&&JSON.stringify(fields(saved))!==JSON.stringify(draft));
  const blocker=useBlocker(Boolean(dirty&&profile?.id===saved?.ownerLearnerId));
  useEffect(()=>{const controller=new AbortController();setLoading(true);setSaved(null);setDraft(null);setRemote(null);setLinkedName(null);setError('');setConflict(false);setJustSaved(false);services.labPreparation.get(sessionId,controller.signal).then(session=>{if(controller.signal.aborted)return;if(session.ownerLearnerId!==uid)throw new ServiceError('The lab preparation does not match your account.');setSaved(session);setDraft(fields(session));}).catch(e=>{if(!controller.signal.aborted)setError(readableError(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});const unregister=services.auth.registerSignOutCleanup(()=>{controller.abort();operation.current?.abort();});return()=>{controller.abort();operation.current?.abort();unregister();};},[services,uid,sessionId,retry]);
  useEffect(()=>{if(!dirty)return;const leave=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[dirty]);
  async function save(next=draft):Promise<boolean>{if(!saved||!next||conflict)return false;const controller=new AbortController();operation.current=controller;setBusy(true);setError('');try{const session=await services.labPreparation.save(saved.id,{...next,expectedRevision:saved.revision},controller.signal);if(controller.signal.aborted)return false;if(session.ownerLearnerId!==uid)throw new ServiceError('The preparation does not match your account.');setSaved(session);setDraft(fields(session));setJustSaved(true);return true;}catch(e){if(!controller.signal.aborted){setError(readableError(e));setConflict(e instanceof ServiceError&&e.status===409);}return false;}finally{if(!controller.signal.aborted)setBusy(false);}}
  async function reloadSaved(){if(!saved)return;const controller=new AbortController();operation.current=controller;setBusy(true);try{const session=await services.labPreparation.get(saved.id,controller.signal);if(controller.signal.aborted)return;if(session.ownerLearnerId!==uid)throw new ServiceError('Wrong saved preparation.');setRemote(session);}catch(e){if(!controller.signal.aborted)setError(readableError(e));}finally{if(!controller.signal.aborted)setBusy(false);}}
  if(loading)return <LoadingNotice>Opening your lab preparation…</LoadingNotice>;
  if(!saved||!draft)return <div className="page-stack"><PageTitle title="Your lab preparation couldn’t open."/><Alert>{error}</Alert><Button onClick={()=>setRetry(n=>n+1)}>Retry opening preparation</Button><ActionLink variant="secondary" to="/labs">Back to Lab mode</ActionLink></div>;
  const index=saved.practical.checkpoints.findIndex(c=>c.id===draft.currentCheckpointId),checkpoint=saved.practical.checkpoints[index],dial=profile?.supportLanguage==='en'?5:profile?.dialLevel??2;
  const instruction=pick(checkpoint.instruction,dial),why=pick(checkpoint.why,dial),link=window.location.origin+saved.sessionPath;
  const edit=(change:Partial<PreparationFields>)=>{setDraft({...draft,...change});setJustSaved(false);};
  // The name is fixed once Kiki starts following a model; until then it must be one Simulink can save.
  const nameError=linkedName?'':modelNameError(draft.projectRef),draftName=modelName(draft.projectRef);
  const nameReady=!modelNameError(saved.projectRef)&&draft.projectRef===saved.projectRef;
  const blocked=busy||conflict||Boolean(nameError);
  return <div className={`page-stack ${styles.screen}`}>
    <ActionLink variant="text" to="/labs">Back to Lab mode</ActionLink>
    <PageTitle eyebrow="LAB · SIMULINK ONLINE" title={saved.practical.title}>{saved.practical.aim}</PageTitle>
    {services.mode==='fixture'&&<p className="helper-note">Sample preparation · Saved in this browser only.</p>}
    <section className={styles.modelCard} aria-labelledby="lab-model-title">
      <span className="eyebrow">STEP 1 · YOUR SIMULINK MODEL</span>
      {linkedName?<>
        <h2 id="lab-model-title">Kiki is following <code>{linkedName}.slx</code></h2>
        <p>Keep building in this model. Its name is fixed for this lab.</p>
      </>:<>
        <h2 id="lab-model-title">Save your model as <code>{draftName}.slx</code></h2>
        <ol className={styles.howItWorks}><li>Open Simulink Online and choose <strong>Blank Model</strong>.</li><li>Press <strong>Save</strong> (Ctrl+S) and type <code>{draftName}</code>. It saves to your {MODEL_FOLDER}.</li></ol>
        <div className={styles.nameField}><label htmlFor="model-name">Model name</label><input id="model-name" maxLength={63} placeholder={DEFAULT_MODEL_NAME} spellCheck={false} autoComplete="off" disabled={busy} aria-invalid={Boolean(nameError)} aria-describedby="model-name-help" value={draft.projectRef} onChange={e=>edit({projectRef:e.target.value})}/><p id="model-name-help" className={nameError?styles.fieldError:'helper-note'}>{nameError||`Leave blank to use ${DEFAULT_MODEL_NAME}. Change it only if you need a different file name.`}</p></div>
      </>}
      <a className="button button-secondary" href={saved.practical.softwareUrl} target="_blank" rel="noopener noreferrer">Open MATLAB / Simulink Online</a>
    </section>
    {services.labExecution?<LabConnection preparationId={saved.id} api={services.labExecution} auth={services.auth} modelName={modelName(saved.projectRef)} modelNameReady={nameReady} onModelName={onModelName}/>:<MonitoringNotice/>}
    <div className={styles.saveBar}><div><span className="eyebrow">YOUR PREPARATION</span><p role="status">{busy?'Saving or loading preparation…':dirty?'Unsaved changes':justSaved?'Preparation saved':`Saved preparation · Revision ${saved.revision}`}</p></div><Button disabled={blocked||!dirty} onClick={()=>void save()}>{busy?'Saving preparation…':'Save preparation'}</Button></div>
    {error&&<Alert>{error}{conflict&&<Button variant="text" disabled={busy} onClick={reloadSaved}>Review saved version</Button>}</Alert>}
    {remote&&<Card><h2>Compare before replacing your notes</h2><p>Your unsaved text remains in the form below. Copy anything you want to keep before choosing the saved version.</p><h3>Saved prediction</h3><pre className={styles.textPreview}>{remote.prediction||'No prediction saved.'}</pre><h3>Saved model name</h3><pre className={styles.textPreview}>{modelName(remote.projectRef)}</pre>{Object.entries(remote.observationNotes).map(([key,value])=><p key={key}>Saved observation {Number(key)+1}: {value}</p>)}<Button onClick={()=>{setSaved(remote);setDraft(fields(remote));setRemote(null);setConflict(false);setError('');}}>Use saved version</Button></Card>}
    <div className={styles.layout}>
    <section className={styles.main}>
      <Card><details className={styles.allSteps} open={!services.labExecution}><summary><h2>All 12 steps</h2><span>Step {index+1} of 12</span></summary>
        <div className={styles.steps} role="navigation" aria-label="Lab checkpoints">{saved.practical.checkpoints.map((c,i)=><Button key={c.id} variant={c.id===checkpoint.id?'primary':'secondary'} aria-label={`Read checkpoint ${i+1}`} aria-current={c.id===checkpoint.id?'step':undefined} disabled={busy} onClick={()=>edit({currentCheckpointId:c.id})}>{i+1}</Button>)}</div>
        <p className="dimension-label lab-text">IN SIMULINK: {checkpoint.targetLabel}</p><h3 lang={instruction.lang}>{instruction.text}</h3>{dial===3&&<p>{checkpoint.instruction.en}</p>}<p lang={why.lang}><strong>Why: </strong>{why.text}</p>{dial===3&&<p>{checkpoint.why.en}</p>}<p><strong>Expected: </strong>{checkpoint.expected}</p>
        <div className="form-actions"><Button variant="secondary" disabled={busy||index===0} onClick={()=>edit({currentCheckpointId:saved.practical.checkpoints[index-1].id})}>Previous checkpoint</Button><Button variant="secondary" disabled={busy||index===11} onClick={()=>edit({currentCheckpointId:saved.practical.checkpoints[index+1].id})}>Next checkpoint</Button></div>
      </details></Card>
      <Card><h2>Lab notebook</h2><form onSubmit={e=>{e.preventDefault();if(!blocked)void save();}} className={styles.form}><label htmlFor="prediction">Your prediction</label><p className="helper-note">{saved.practical.predictionPrompt}</p><textarea id="prediction" rows={4} maxLength={3000} disabled={busy} value={draft.prediction} onChange={e=>edit({prediction:e.target.value})}/>{saved.practical.observationPrompts.map((prompt,i)=>{const text=pick(prompt,dial);return <div key={i} className={styles.form}><label htmlFor={`observation-${i}`}>Observation {i+1} · Your notes</label><p lang={text.lang}>{text.text}</p>{dial===3&&<p>{prompt.en}</p>}<textarea id={`observation-${i}`} rows={3} maxLength={3000} disabled={busy} value={draft.observationNotes[String(i)]??''} onChange={e=>edit({observationNotes:{...draft.observationNotes,[String(i)]:e.target.value}})}/></div>;})}</form></Card>
    </section>
    <aside className={styles.sidebar} aria-label="Lab references and continuation">
      <Card><details className={styles.readiness}><summary>Theory readiness · {7-saved.readiness.missingConceptIds.length}/7</summary><Readiness value={saved.readiness}/></details></Card>
      <Card><details className={styles.readiness}><summary>Continue on another device</summary><p>Sign in with the same Google account on the other device. Save first.</p><label htmlFor="lab-session-link">Session link</label><input id="lab-session-link" readOnly value={link}/><Button variant="secondary" disabled={dirty||busy} onClick={async()=>{try{await navigator.clipboard.writeText(link);setCopied(true);setCopyError('');}catch{setCopyError('Copy the session link from the field above.');}}}>Copy session link</Button>{copied&&<p role="status">Session link copied</p>}{copyError&&<p role="status">{copyError}</p>}{['127.0.0.1','localhost','[::1]'].includes(window.location.hostname)&&<p className="helper-note">Local preview: this address works on this computer. Phone/laptop continuation needs the app at a shared hosted address.</p>}</details></Card>
      <Card><details className={styles.readiness}><summary>Content sources · {saved.practical.reviewStatus}</summary><ul>{saved.practical.sources.map((source,i)=><li key={i}>{source.url?<a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>:source.label}</li>)}</ul></details></Card>
    </aside></div>
    <p className="helper-note">Kiki’s screen reads guide you; they don’t grade your practical. Your notes and confirmations are your own reports. Your model lives in your {MODEL_FOLDER}, not in Kiki.</p>
    {blocker.state==='blocked'&&<LeavePreparation onStay={()=>blocker.reset()}><h2 id="lab-leave-title">Save your preparation before leaving?</h2><p id="lab-leave-description">Your changes are still on this page.</p>{error&&<Alert>{error}</Alert>}<div className="form-actions"><Button variant="secondary" disabled={busy} onClick={()=>blocker.reset()}>Keep editing</Button><Button variant="secondary" disabled={busy} onClick={()=>blocker.proceed()}>Leave without saving</Button><Button disabled={blocked} onClick={async()=>{if(await save())blocker.proceed();}}>Save and leave</Button></div></LeavePreparation>}
  </div>;
}
function LeavePreparation({children,onStay}:{children:ReactNode;onStay():void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);return <dialog className="leave-dialog" ref={ref} aria-labelledby="lab-leave-title" aria-describedby="lab-leave-description" onCancel={e=>{e.preventDefault();onStay();}}>{children}</dialog>;}
