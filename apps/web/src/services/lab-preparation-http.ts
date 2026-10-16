import type {z} from 'zod';
import type {AuthService} from '../contracts/services';
import {PracticalEnvelope,PreparationEnvelope,ActivePreparationEnvelope,type LabPreparationApi} from '../contracts/lab-preparation';
import {ServiceError} from './types';
export function createLabPreparationApi(baseUrl:string,auth:AuthService,fetcher:typeof fetch=fetch):LabPreparationApi {
  async function call<T>(path:string,schema:z.ZodType<T>,signal?:AbortSignal,method='GET',body?:unknown):Promise<T> {
    const response=await fetcher(baseUrl.replace(/\/$/,'')+path,{method,headers:{Authorization:`Bearer ${await auth.getIdToken()}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
    if(!response.ok) throw new ServiceError(response.status===409?'These notes changed on another device. Your unsaved text is kept below. Reload the saved version before making another change.':response.status===403?'Add Analog Communication from Home → Add your subject first.':response.status===404?'This lab preparation was not found for your account.':response.status===401?'Sign in again to open your lab preparation.':'Lab preparation could not be saved or loaded. Please retry.',response.status);
    const parsed=schema.safeParse(await response.json());if(!parsed.success)throw new ServiceError('The lab service returned an unsupported response.');return parsed.data;
  }
  return {
    practical:async s=>(await call('/practicals/PR-AM-DSB',PracticalEnvelope,s)).practical,
    active:async s=>(await call('/lab-preparations/active?practicalId=PR-AM-DSB',ActivePreparationEnvelope,s)).preparation,
    start:async s=>(await call('/lab-preparations',PreparationEnvelope,s,'POST',{practicalId:'PR-AM-DSB'})).preparation,
    get:async(id,s)=>{const {preparation}=await call(`/lab-preparations/${encodeURIComponent(id)}`,PreparationEnvelope,s);if(preparation.id!==id)throw new ServiceError('This preparation belongs to another session.');return preparation;},
    save:async(id,body,s)=>{const {preparation}=await call(`/lab-preparations/${encodeURIComponent(id)}`,PreparationEnvelope,s,'PATCH',body);if(preparation.id!==id)throw new ServiceError('This preparation belongs to another session.');return preparation;},
  };
}
