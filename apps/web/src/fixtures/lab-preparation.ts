import data from './lab-practical.json';
import {PracticalSchema,PreparationSchema,type LabPreparation,type LabPreparationApi} from '../contracts/lab-preparation';
import type {LearningApi} from '../contracts/services';
import {ServiceError} from '../services/types';
/** Explicit sample mode only; reading/taking notes never adds evidence or mastery. */
export function createFixtureLabPreparation(uid:()=>string,learning:LearningApi):LabPreparationApi {
  const practical=PracticalSchema.parse(data),key=()=>`kiki:lab-preparation:fixture:v1:${uid()}`;
  const owner=(who:string,signal?:AbortSignal)=>{signal?.throwIfAborted();if(uid()!==who)throw new ServiceError('Your account changed. Reopen Lab mode.');};
  const read=()=>{const raw=localStorage.getItem(key());if(!raw)return null;try{const record=PreparationSchema.parse(JSON.parse(raw));if(record.ownerLearnerId!==uid())throw new Error();return record;}catch{throw new ServiceError('Your saved lab notes could not be read. Previous data was kept.');}};
  const write=(record:LabPreparation)=>{try{localStorage.setItem(key(),JSON.stringify(PreparationSchema.parse(record)));}catch{throw new ServiceError('Your lab notes were not saved. Retry when browser storage is available.');}};
  async function view(record:LabPreparation,signal?:AbortSignal){const who=uid();const progress=await learning.getProgress(practical.planId,signal);owner(who,signal);return PreparationSchema.parse({...record,readiness:progress.labReadiness});}
  const active=async(signal?:AbortSignal)=>{const record=read();return record?view(record,signal):null;};
  return {
    practical:async s=>{s?.throwIfAborted();uid();return structuredClone(practical);},active,
    start:async s=>{const who=uid();const saved=await active(s);if(saved)return saved;const progress=await learning.getProgress(practical.planId,s);owner(who,s);const id=`prep-${crypto.randomUUID()}`,timestamp=new Date().toISOString();const record=PreparationSchema.parse({schema:'lab-preparation/v1',id,ownerLearnerId:who,practicalId:practical.practicalId,contentVersion:practical.contentVersion,revision:0,currentCheckpointId:practical.checkpoints[0].id,prediction:'',projectRef:'',observationNotes:{},createdAt:timestamp,updatedAt:timestamp,readiness:progress.labReadiness,monitoring:{status:'pending_integration',pointerActive:false,assessmentStatus:'not_assessed'},sessionPath:`/labs/${id}`,practical});write(record);return record;},
    get:async(id,s)=>{const record=await active(s);if(!record||record.id!==id)throw new ServiceError('This lab preparation was not found for your sample account.',404);return record;},
    save:async(id,update,s)=>{const who=uid();const record=await active(s);owner(who,s);if(!record||record.id!==id)throw new ServiceError('This lab preparation was not found.',404);if(record.revision!==update.expectedRevision)throw new ServiceError('These notes changed on another device. Your unsaved text was kept. Reload the saved version.',409);const {expectedRevision:_,...fields}=update;void _;const saved=PreparationSchema.parse({...record,...fields,revision:record.revision+1,updatedAt:new Date().toISOString()});write(saved);return saved;},
  };
}
