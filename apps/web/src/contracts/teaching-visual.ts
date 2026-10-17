import {z} from 'zod';
export const DsbVisualSchema=z.object({
  schema:z.literal('dsb-sc-visual/v1'),kind:z.literal('dsb_sc'),
  messageFrequencyHz:z.number().positive(),carrierFrequencyHz:z.number().positive(),
  messageRangeHz:z.object({min:z.number().positive(),max:z.number().positive(),step:z.number().positive()}),
  sidebandTermId:z.literal('T-AM-04-2'),carrierTermId:z.literal('T-AM-02-2'),signalTermId:z.literal('T-AM-04-1'),
  sources:z.array(z.object({origin:z.string(),label:z.string(),url:z.string().url().optional()})),
}).refine(v=>v.messageRangeHz.min<=v.messageFrequencyHz&&v.messageFrequencyHz<=v.messageRangeHz.max&&v.messageRangeHz.max<v.carrierFrequencyHz&&v.messageRangeHz.step<=v.messageRangeHz.max-v.messageRangeHz.min,'Invalid ideal single-tone frequency range.');
export type DsbVisual=z.infer<typeof DsbVisualSchema>;
