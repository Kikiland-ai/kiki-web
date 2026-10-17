import {useEffect,useState} from 'react';
import {useSession} from '../../app/Session';
import type {LabPreparation} from '../../contracts/lab-preparation';
import {ActionLink,Card} from '../../ui/kit';
export function ResumeLab(){
  const {services,profile}=useSession();const [active,setActive]=useState<LabPreparation|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{const controller=new AbortController();setActive(null);setFailed(false);services.labPreparation.active(controller.signal).then(s=>{if(!controller.signal.aborted){if(s&&s.ownerLearnerId!==profile?.id)throw new Error('Wrong owner');setActive(s);}}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[services,profile?.id]);
  if(failed)return <Card><p>Your saved lab preparation could not be loaded.</p><ActionLink variant="secondary" to="/labs">Open Lab mode</ActionLink></Card>;
  return active?<Card className="lab-resume"><span className="dimension-label lab-text">YOUR SAVED LAB PREPARATION</span><h2>Continue preparing DSB-SC.</h2><p>Your notes and reading position are saved. Software monitoring is not connected yet.</p><ActionLink to={active.sessionPath}>Resume lab preparation</ActionLink></Card>:null;
}
