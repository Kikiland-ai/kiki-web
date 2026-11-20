import {z} from 'zod';

const Text=z.object({en:z.string(),or:z.string()});
export const PhysicalPart=z.object({id:z.string(),label:z.string(),kind:z.enum(['body','input','output','control','display']),position:z.tuple([z.number(),z.number(),z.number()]),size:z.tuple([z.number(),z.number(),z.number()])}).passthrough();
export type PhysicalPart=z.infer<typeof PhysicalPart>;
export const PhysicalRule=z.object({kind:z.enum(['select','connect','set','measure']),target:z.string(),other:z.string().nullable().optional(),unit:z.string().nullable().optional()}).passthrough();
export type PhysicalRule=z.infer<typeof PhysicalRule>;
export const PhysicalPack=z.object({id:z.string(),version:z.string(),title:z.string(),asset:z.string().regex(/^[a-zA-Z0-9_.-]+\.gltf$/),asset_sha256:z.string(),parts:z.array(PhysicalPart),controls:z.record(z.string(),z.object({initial:z.union([z.number(),z.string(),z.boolean()]),minimum:z.number().nullable(),maximum:z.number().nullable(),choices:z.array(z.string()),unit:z.string().nullable()})),steps:z.array(z.object({id:z.string(),rule:PhysicalRule,instruction:Text,why:Text}))}).passthrough();
export type PhysicalPack=z.infer<typeof PhysicalPack>;
export const PhysicalSession=z.object({schema_version:z.literal('physical-lab-session/v1'),session_id:z.string().regex(/^[a-f0-9]{32}$/),experiment_id:z.string(),mode:z.enum(['experiment_demo','guided_preparation']),revision:z.number().int().nonnegative(),stage:z.string(),pack_version:z.string(),language:z.enum(['en','or']),apparatus:z.object({controls:z.record(z.string(),z.union([z.number(),z.string(),z.boolean()])),connections:z.array(z.tuple([z.string(),z.string()]))}).passthrough(),feedback:z.object({passed:z.boolean().optional(),message:z.string().optional(),step_id:z.string().optional()}).passthrough().nullable(),activity:z.object({step:z.object({id:z.string(),rule:PhysicalRule,instruction:Text,why:Text}).optional(),number:z.number().optional(),total:z.number().optional()}).passthrough()}).passthrough();
export type PhysicalSession=z.infer<typeof PhysicalSession>;
export const PhysicalObservations=z.object({readings:z.record(z.string(),z.number()),traces:z.object({message_v:z.array(z.number()),dsb_sc_v:z.array(z.number()),recovered_v:z.array(z.number())}).passthrough()}).passthrough();
export type PhysicalObservations=z.infer<typeof PhysicalObservations>;
export const PhysicalSummary=z.object({mode:z.enum(['experiment_demo','guided_preparation']),session_id:z.string(),experiment_id:z.string(),stage:z.string(),updated_at:z.string()}).passthrough();
export type PhysicalEvent={event_id:string;revision:number;kind:'connect'|'set'|'measure'|'select';target:string;other?:string;value?:number|string|boolean;unit?:string};
export interface PhysicalLabApi {
  sessions(signal?:AbortSignal):Promise<z.infer<typeof PhysicalSummary>[]>;
  create(experiment:string,language:'en'|'or',key:string,signal?:AbortSignal):Promise<PhysicalSession>;
  get(id:string,signal?:AbortSignal):Promise<PhysicalSession>;
  pack(id:string,signal?:AbortSignal):Promise<PhysicalPack>;
  asset(pack:PhysicalPack,signal?:AbortSignal):Promise<unknown>;
  event(id:string,event:PhysicalEvent,signal?:AbortSignal):Promise<PhysicalSession>;
  observations(id:string,signal?:AbortSignal):Promise<PhysicalObservations>;
}
