import type { NarrationRendition } from '../../contracts/concept-media'
import timings from './narrationTimings.json'

/** What the scene draws attention to while a cue is active. */
export type SceneFocus = 'aligned' | 'formula' | 'half' | 'null' | 'residual' | 'frequency' | 'control'

/** A hand-placed cue: a sentence start plus what the phase-recovery scene shows for it. */
export type SceneCue = {
  /** Seconds into the clip where this sentence starts. */
  at: number
  /** Phase error the scene moves to; omitted when the sentence keeps the current picture. */
  phi?: number
  focus: SceneFocus
  /** The words this sentence starts with, exactly as in the placard text, for the reading highlight. */
  from: string
  /** One short line naming what the narration is saying now. */
  caption: string
}

/** A sentence start found from the pauses in the recording. */
export type SentenceCue = {
  at: number
  from: string
  /** The placard this sentence is on (a whole-concept clip reads several). */
  placardId: string
  /** Where the sentence starts in that placard's text. */
  start: number
}

export type NarrationCue = SceneCue | SentenceCue

/**
 * Cues for one exact recording, keyed by its audio hash so a re-generated clip gets none.
 * `manual`: a person placed each cue on the sentence starts, using the pauses in the audio, and
 * gave it a scene beat. `pauses`: scripts/build-narration-timings.mjs found the sentence starts
 * from the pauses (within 0.1 s of the hand-placed starts where both exist). Neither is word
 * alignment: the contracts stay `clip_duration_only` / `not_performed`, and the UI says so.
 */
export type CueTrack =
  | { renditionId: string; audioSha256: string; timing: 'manual'; cues: SceneCue[] }
  | { renditionId: string; audioSha256: string; timing: 'pauses'; cues: SentenceCue[] }

const ALIGNED = 'Aligned receiver: the whole message comes back'
const FORMULA = 'Phase error φ scales the recovered message by cos φ'
const HALF = '60° error: half the amplitude is left'
const NULL = '90° error: the message-band part is suppressed'
const RESIDUAL = 'A real filter can leave a small ripple, so 90° is rarely a flat zero'
const FREQUENCY = 'A frequency mismatch makes the recovery drift (not drawn in this scene)'
const CONTROL = 'Check the transmitter, then match the oscillator’s frequency and phase'

type HandTrack = Extract<CueTrack, { timing: 'manual' }>

const TRACKS: HandTrack[] = [
  {
    renditionId: 'CARD-AM-08-concept.en',
    audioSha256: 'bde8c0f42f79fae1fadcddaff378d0ccbc6a223e44ede2632f4b19084da519a7',
    timing: 'manual',
    cues: [
      { at: 0.3, phi: 0, focus: 'aligned', caption: ALIGNED, from: 'Carrier mismatch is' },
      { at: 7.2, phi: 0, focus: 'formula', caption: FORMULA, from: 'With equal carrier' },
      { at: 18.1, phi: 60, focus: 'half', caption: HALF, from: 'A 60 degree error' },
      { at: 21.2, phi: 90, focus: 'null', caption: NULL, from: 'a 90 degree error' },
      { at: 26.8, focus: 'residual', caption: RESIDUAL, from: 'A finite filter' },
      { at: 36.3, focus: 'frequency', caption: FREQUENCY, from: 'A frequency mismatch' },
      { at: 45.6, phi: 0, focus: 'control', caption: CONTROL, from: 'Inspect the transmitter' },
    ],
  },
  {
    renditionId: 'CARD-AM-08-concept.or',
    audioSha256: '2047beec8dee933ff91b058db260011d676ad2e9cd11ecad22e21a732f618a30',
    timing: 'manual',
    cues: [
      { at: 0.3, phi: 0, focus: 'aligned', caption: ALIGNED, from: 'Carrier mismatch receiver' },
      { at: 9.5, phi: 0, focus: 'formula', caption: FORMULA, from: 'Frequency ସମାନ' },
      { at: 20.2, phi: 60, focus: 'half', caption: HALF, from: '60 degree error ରେ' },
      { at: 24.5, phi: 90, focus: 'null', caption: NULL, from: '90 degree error ରେ' },
      { at: 30.7, focus: 'residual', caption: RESIDUAL, from: 'finite Filter' },
      { at: 35.9, focus: 'frequency', caption: FREQUENCY, from: 'Frequency mismatch ରେ' },
      { at: 41.0, phi: 0, focus: 'control', caption: CONTROL, from: 'ପ୍ରଥମେ transmitter' },
    ],
  },
  {
    renditionId: 'CARD-AM-08-application.en',
    audioSha256: '0b8b07405a8e384139414dba31cb3b525baaa7a5fb51809f728df6766c8e2e5b',
    timing: 'manual',
    cues: [
      { at: 0.3, phi: 90, focus: 'control', caption: 'Change only the receiver phase, by 90°', from: 'Change only the receiver phase' },
      { at: 4.6, focus: 'null', caption: 'Inspect the recovery: the message-band part is gone', from: 'inspect recovery' },
      { at: 6.2, phi: 0, focus: 'aligned', caption: 'Restore the baseline phase and run again', from: 'then restore the baseline' },
    ],
  },
  {
    renditionId: 'CARD-AM-08-application.or',
    audioSha256: 'b53dd2227bbdd7dc728a400c35fb42ca7843c4133c5d428b14446f4ecd57972d',
    timing: 'manual',
    cues: [
      { at: 0.3, phi: 90, focus: 'control', caption: 'Change only the receiver phase, by 90°', from: 'କେବଳ Receiver phase' },
      { at: 5.3, focus: 'null', caption: 'Inspect the recovery: the message-band part is gone', from: 'Recovery ଦେଖି' },
      { at: 6.9, phi: 0, focus: 'aligned', caption: 'Restore the baseline phase and run again', from: 'baseline Phase ଫେରାଇ' },
    ],
  },
]

const FOUND: CueTrack[] = timings.tracks.map((t) => ({
  renditionId: t.renditionId,
  audioSha256: t.audioSha256,
  timing: 'pauses' as const,
  cues: t.sentences.map((s) => ({ at: s.at, from: s.from, placardId: s.placardId, start: s.start })),
}))

/**
 * The cue track for this exact recording, or null: the hand-placed track (with scene beats) when
 * there is one, otherwise the sentence starts found from its pauses. A re-generated clip gets none.
 */
export function cueTrackFor(rendition: Pick<NarrationRendition, 'renditionId' | 'audioSha256'> | null | undefined): CueTrack | null {
  if (!rendition) return null
  const same = (t: CueTrack) => t.renditionId === rendition.renditionId && t.audioSha256 === rendition.audioSha256
  return TRACKS.find(same) ?? FOUND.find(same) ?? null
}

/** The placard the cue at `index` is reading, when the track knows it (whole-concept clips). */
export function cuePlacardId(track: CueTrack, index: number): string | null {
  return track.timing === 'pauses' ? track.cues[index]?.placardId ?? null : null
}

/** Index of the cue in force at `seconds`, or null before the first one. */
export function activeCueIndex(track: CueTrack, seconds: number): number | null {
  let index: number | null = null
  track.cues.forEach((cue, i) => { if (cue.at <= seconds) index = i })
  return index
}

/**
 * The stretch of placard text the cue at `index` is reading: from its opening words up to
 * the next cue's. Null when the words aren't found (edited text gets no wrong highlight).
 */
export function cueTextRange(track: CueTrack, index: number, text: string, placardId?: string): { start: number; end: number } | null {
  if (track.timing === 'pauses') {
    // Found sentences carry their exact place; they light only on their own placard
    const cue = track.cues[index]
    if (!cue || (placardId && cue.placardId !== placardId) || !text.startsWith(cue.from, cue.start)) return null
    const next = track.cues[index + 1]
    let end = next && next.placardId === cue.placardId && next.start > cue.start ? next.start : text.length
    while (end > cue.start && /\s/.test(text[end - 1])) end--
    return { start: cue.start, end }
  }
  const start = text.indexOf(track.cues[index].from)
  if (start < 0) return null
  const next = track.cues[index + 1]
  const nextAt = next ? text.indexOf(next.from, start + 1) : -1
  let end = nextAt > start ? nextAt : text.length
  while (end > start && /\s/.test(text[end - 1])) end--
  return { start, end }
}

/**
 * How far through the current sentence the voice is, as a split point in the text. Progress is
 * spread evenly between this sentence's start and the next one (or the clip's end), then moved to
 * the end of the word it falls in. An even-pace estimate, not word alignment.
 */
export function readingSplit(track: CueTrack, index: number, seconds: number, clipSeconds: number, text: string, placardId?: string): { start: number; readTo: number; end: number } | null {
  const range = cueTextRange(track, index, text, placardId)
  if (!range) return null
  const from = track.cues[index].at
  const until = track.cues[index + 1]?.at ?? clipSeconds
  const progress = until > from ? Math.min(1, Math.max(0, (seconds - from) / (until - from))) : 1
  let readTo = range.start + Math.round(progress * (range.end - range.start))
  while (readTo < range.end && readTo > range.start && !/\s/.test(text[readTo])) readTo++
  return { start: range.start, readTo: Math.min(readTo, range.end), end: range.end }
}

/** For checks: the hand-placed tracks, and the tracks found from pauses. */
export const cueTracks: readonly HandTrack[] = TRACKS
export const foundTracks: readonly CueTrack[] = FOUND
