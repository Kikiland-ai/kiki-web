import { z } from 'zod';

/** Tutor mode wire contract. Mirrors apps/api kiki_api/tutor/service.py views. */
export const LText = z.object({ en: z.string(), or: z.string().optional() });
export type LText = z.infer<typeof LText>;
export const Level = z.enum(['ok', 'partial', 'not_yet', 'n/a']);
export type Level = z.infer<typeof Level>;
export const Dim = z.enum(['concept', 'words', 'english', 'lab']);
export type Dim = z.infer<typeof Dim>;

const Tone = z.object({ a: z.number(), f: z.number(), phaseDeg: z.number().optional() });
const Base = { id: z.string(), stage: z.string().optional() };
export const BoardItem = z.discriminatedUnion('kind', [
  z.object({ ...Base, kind: z.literal('question'), text: LText, given: z.array(LText).optional() }),
  z.object({ ...Base, kind: z.literal('equation'), tex: z.string(), label: LText.optional() }),
  z.object({ ...Base, kind: z.literal('step'), tex: z.string(), note: LText.optional() }),
  z.object({ ...Base, kind: z.literal('note'), text: LText }),
  z.object({ ...Base, kind: z.literal('term'), termId: z.string(), term: z.string().optional(), meaning: LText.optional() }),
  z.object({ ...Base, kind: z.literal('result'), tex: z.string().optional(), text: LText.optional() }),
  z.object({
    ...Base, kind: z.literal('figure'), caption: LText,
    template: z.enum(['waveform', 'spectrum', 'block']),
    params: z.record(z.string(), z.unknown()),
  }),
]);
export type BoardItem = z.infer<typeof BoardItem>;

export const WaveformParams = z.object({
  series: z.array(z.object({ label: LText, tones: z.array(Tone), style: z.enum(['reference', 'signal', 'envelope', 'muted']).optional() })),
  t: z.tuple([z.number(), z.number()]), yRange: z.tuple([z.number(), z.number()]),
  xLabel: LText.optional(), yLabel: LText.optional(),
});
export const SpectrumParams = z.object({
  lines: z.array(z.object({ f: z.number(), a: z.number(), label: LText.optional(), style: z.enum(['carrier', 'sideband', 'message', 'muted']).optional() })),
  fRange: z.tuple([z.number(), z.number()]), unit: z.enum(['Hz', 'kHz', 'MHz']).optional(),
  bands: z.array(z.tuple([z.number(), z.number()])).optional(),
});
export const BlockParams = z.object({
  blocks: z.array(z.object({ id: z.string(), label: LText, kind: z.string() })),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })),
});

const Reveal = z.object({ item: z.string(), on: z.string() });
export const Segment = z.object({
  kind: z.enum(['framing', 'ack', 'intro', 'show', 'probe', 'hint', 'restate', 'conclusion']),
  node: z.string().optional(), say: z.string(), reveals: z.array(Reveal).default([]), focus: z.array(z.string()).default([]),
});
export type Segment = z.infer<typeof Segment>;

export const Brief = z.object({
  mode: z.enum(['scripted', 'guided']), lang: z.enum(['en', 'or']), expectsReply: z.boolean(),
  say: z.string(), segments: z.array(Segment), cuePhrases: z.array(z.string()).default([]),
  goal: z.string().optional(), mustNotReveal: z.array(z.string()).optional(), studentSaid: z.string().nullable().optional(),
});
export type Brief = z.infer<typeof Brief>;

export const TurnView = z.object({
  sessionId: z.string(), questionId: z.string(), status: z.enum(['active', 'completed']),
  stageIndex: z.number(), stage: z.string(), node: z.string(), hintLevel: z.number(), turn: z.number(),
  lang: z.enum(['en', 'or']), brief: Brief,
  chips: z.array(z.object({ label: LText, route: z.string() })),
  board: z.array(BoardItem), revealed: z.array(z.string()),
  route: z.object({ label: z.string(), confidence: z.number(), quote: z.string().nullable().optional(), termsUsed: z.array(z.string()) }).nullable(),
  done: z.boolean(), timing: z.object({ modelMs: z.number() }),
  retry: z.boolean().optional(),          // the model was unreachable: nothing moved, please say it again
});
export type TurnView = z.infer<typeof TurnView>;

export const QuestionView = z.object({
  id: z.string(), version: z.string(), title: LText, difficulty: z.string(), conceptIds: z.array(z.string()),
  languages: z.array(z.enum(['en', 'or'])),
  review: z.object({ content: z.string(), languages: z.record(z.string(), z.string()) }),
  stages: z.array(z.object({ id: z.string(), title: LText })),
  metrics: z.array(z.object({ id: z.string(), label: LText, dim: Dim })),
});
export type QuestionView = z.infer<typeof QuestionView>;

const Pointer = z.object({ concept: z.string(), why: z.string(), title: z.string().optional() });
export const Report = z.object({
  questionId: z.string(), completed: z.boolean(),
  metrics: z.array(z.object({ id: z.string(), dim: Dim, level: Level, quotes: z.array(z.string()), termsUsed: z.array(z.string()).optional() })),
  stages: z.array(z.object({ id: z.string(), turns: z.number(), hints: z.number(), forced: z.boolean(), misconceptions: z.array(z.string()), level: Level })),
  revise: z.array(Pointer), strengthen: z.array(Pointer),
  next: z.array(z.object({ kind: z.string(), id: z.string(), why: LText })),
  sheet: z.array(z.string()), board: z.array(BoardItem),
  summary: z.string().nullable(), turns: z.number(), hints: z.number(),
  speechLeaks: z.array(z.object({ node: z.string().nullable().optional(), phrase: z.string().nullable().optional() })),
});
export type Report = z.infer<typeof Report>;

export const SpeechResult = z.object({ leaks: z.array(z.string()) });

export const VoiceToken = z.object({ token: z.string(), model: z.string(), expiresAt: z.string(), prompt: z.string() });
export type VoiceToken = z.infer<typeof VoiceToken>;

export type TurnInput = { text: string; mode?: 'text' | 'voice' } | { chip: string };

export interface TutorApi {
  question(questionId: string, signal?: AbortSignal): Promise<QuestionView>
  start(questionId: string, lang: 'en' | 'or', key: string, signal?: AbortSignal): Promise<TurnView>
  get(sessionId: string, signal?: AbortSignal): Promise<TurnView>
  turn(sessionId: string, input: TurnInput, key: string, signal?: AbortSignal): Promise<TurnView>
  report(sessionId: string, signal?: AbortSignal): Promise<Report>
  speech(sessionId: string, text: string): Promise<{ leaks: string[] }>
  voiceToken(sessionId: string): Promise<VoiceToken>
}

/** Which tutor questions a concept page offers. */
export const TUTOR_QUESTIONS: Record<string, { id: string; title: string; difficulty: string }[]> = {
  'C-AM-03': [
    { id: 'ece-am-envelope-design', title: 'Designing an AM envelope detector', difficulty: 'hard' },
  ],
  'C-AM-08': [
    { id: 'ece-phase-error', title: 'Phase error in a coherent receiver', difficulty: 'medium' },
    { id: 'ece-dsb-receive-drift', title: 'Receiving DSB-SC: envelope, coherent detection and drift', difficulty: 'hard' },
  ],
};
