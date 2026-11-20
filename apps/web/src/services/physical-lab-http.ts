import {z} from 'zod';
import type {AuthService} from '../contracts/services';
import {PhysicalPack,PhysicalSession,PhysicalObservations,PhysicalSummary,type PhysicalLabApi} from '../contracts/physical-lab';
import {ServiceError} from './types';
import {PhysicalLabNarrationManifestSchema} from '../contracts/lab-narration';
import {createLabNarrationApi} from './lab-narration-http';

/** Uses the existing verified web API. No browser-owned upstream identity or secret. */
export function createPhysicalLabApi(baseUrl:string,auth:AuthService,fetcher:typeof fetch=fetch):PhysicalLabApi {
  const base=baseUrl.replace(/\/$/,'')+'/physical-labs';
  async function call<T>(path:string,schema:z.ZodType<T>,signal?:AbortSignal,body?:unknown,key?:string):Promise<T>{
    const token=await auth.getIdToken();signal?.throwIfAborted();
    const response=await fetcher(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});
    if(!response.ok)throw new ServiceError(response.status===409?'This experiment changed. Reload the saved session before continuing.':response.status===401?'Sign in again to open your physical experiment.':response.status===403?'Add Analog Communication before opening this experiment.':response.status===404?'This experiment was not found for your account.':'Physical experiment practice is unavailable. Your saved progress is kept.',response.status);
    const parsed=schema.safeParse(await response.json());if(!parsed.success)throw new ServiceError('The physical lab service returned an unsupported response.');return parsed.data;
  }
  async function session(id:string,signal?:AbortSignal){const s=await call(`/sessions/${encodeURIComponent(id)}`,PhysicalSession,signal);if(s.session_id!==id)throw new ServiceError('The experiment belongs to another session.');return s;}
  return {
    narration: createLabNarrationApi(id => `${base}/sessions/${id}/narration`, PhysicalLabNarrationManifestSchema, auth, fetcher),
    sessions:s=>call('/sessions',z.array(PhysicalSummary),s),
    create:(id,language,key,s)=>call('/sessions',PhysicalSession,s,{experiment_id:id,language,mode:'experiment_demo'},key),
    get:session,
    pack:(id,s)=>call(`/sessions/${encodeURIComponent(id)}/pack`,PhysicalPack,s),
    asset:async(pack,s)=>{
      const data=await call(`/assets/${encodeURIComponent(pack.asset)}`,z.unknown(),s);
      // Asset hashes are checked at backend pack admission. The fixed proxy supplies
      // only allowlisted embedded glTF assets; no external buffer requests are made.
      return data;
    },
    event:async(id,event,s)=>{const next=await call(`/sessions/${encodeURIComponent(id)}/events`,PhysicalSession,s,event);if(next.session_id!==id)throw new ServiceError('The experiment belongs to another session.');return next;},
    observations:(id,s)=>call(`/sessions/${encodeURIComponent(id)}/observations`,PhysicalObservations,s),
  };
}
