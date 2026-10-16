import { z } from 'zod';
import { ASSESSMENT_CONCEPTS } from './assessment-catalog';
const Text = z.object({ en: z.string().min(1), or: z.string().min(1) });
export const PracticalSchema = z.object({
  practicalId: z.literal('PR-AM-DSB'), planId: z.literal('LP-ANALOG-MODULATION'), contentVersion: z.string().regex(/^am-[a-f0-9]{24}$/),
  title: z.string(), aim: z.string(), softwareName: z.string(), softwareUrl: z.literal('https://matlab.mathworks.com/'),
  predictionPrompt: z.string(), observationPrompts: z.array(Text).length(2),
  checkpoints: z.array(z.object({ id:z.string(), stepNumber:z.number().int(), targetLabel:z.string(), instruction:Text, why:Text, expected:z.string(), evidenceKind:z.string(), prerequisiteCheckpointIds:z.array(z.string()) })).length(12),
  sources:z.array(z.object({origin:z.string(),label:z.string(),url:z.string().url().nullable().optional()})), reviewStatus:z.enum(['draft','reviewed']),
}).superRefine((p,ctx)=>{if(new Set(p.checkpoints.map(c=>c.id)).size!==12 || p.checkpoints.some((c,i)=>c.stepNumber!==i+1)) ctx.addIssue({code:'custom',message:'Invalid checkpoint sequence.'});});
export const PreparationSchema = z.object({
  schema:z.literal('lab-preparation/v1'), id:z.string().regex(/^prep-[a-f0-9-]{36}$/), ownerLearnerId:z.string().min(1), practicalId:z.literal('PR-AM-DSB'), contentVersion:z.string(), revision:z.number().int().nonnegative(),
  currentCheckpointId:z.string(), prediction:z.string().max(3000), projectRef:z.string().max(500), observationNotes:z.record(z.string(),z.string().max(3000)), createdAt:z.string().datetime(), updatedAt:z.string().datetime(),
  readiness:z.object({practicalId:z.literal('PR-AM-DSB'),ready:z.boolean(),requiredConceptIds:z.array(z.string()),missingConceptIds:z.array(z.string()),evidenceRunIds:z.array(z.string()),chapterTestRequired:z.literal(false)}),
  monitoring:z.object({status:z.literal('pending_integration'),pointerActive:z.literal(false),assessmentStatus:z.literal('not_assessed')}),
  sessionPath:z.string(), practical:PracticalSchema,
}).superRefine((s,ctx)=>{
  const required=ASSESSMENT_CONCEPTS.filter(c=>c.requiredForLab).map(c=>c.id as string), r=s.readiness;
  if(s.sessionPath!==`/labs/${s.id}` || s.contentVersion!==s.practical.contentVersion || !s.practical.checkpoints.some(c=>c.id===s.currentCheckpointId) || Object.keys(s.observationNotes).some(k=>!['0','1'].includes(k)) || r.requiredConceptIds.length!==7 || new Set(r.requiredConceptIds).size!==7 || r.requiredConceptIds.some(c=>!required.includes(c)) || new Set(r.missingConceptIds).size!==r.missingConceptIds.length || r.missingConceptIds.some(c=>!required.includes(c)) || r.ready!==(r.missingConceptIds.length===0)) ctx.addIssue({code:'custom',message:'Preparation/version/readiness mismatch.'});
});
export type Practical = z.infer<typeof PracticalSchema>;
export type LabPreparation = z.infer<typeof PreparationSchema>;
export type PreparationFields = Pick<LabPreparation,'currentCheckpointId'|'prediction'|'projectRef'|'observationNotes'>;
export type PreparationUpdate = PreparationFields & {expectedRevision:number};
export interface LabPreparationApi {
  practical(signal?:AbortSignal):Promise<Practical>;
  active(signal?:AbortSignal):Promise<LabPreparation|null>;
  start(signal?:AbortSignal):Promise<LabPreparation>;
  get(id:string,signal?:AbortSignal):Promise<LabPreparation>;
  save(id:string,update:PreparationUpdate,signal?:AbortSignal):Promise<LabPreparation>;
}
export const PracticalEnvelope=z.object({practical:PracticalSchema});
export const PreparationEnvelope=z.object({preparation:PreparationSchema});
export const ActivePreparationEnvelope=z.object({preparation:PreparationSchema.nullable()});
