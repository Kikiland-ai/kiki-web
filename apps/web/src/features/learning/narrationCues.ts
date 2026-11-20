import type { NarrationRendition } from '../../contracts/concept-media'

/** What the scene draws attention to while a cue is active. */
export type SceneFocus = 'aligned' | 'formula' | 'half' | 'null' | 'residual' | 'frequency' | 'control'

export type NarrationCue = {
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

/**
 * Cues for one exact recording. `timing: 'manual'` means a person placed each cue on the
 * sentence starts, using the pauses in the audio. It is not word alignment: the audio and
 * text contracts stay `clip_duration_only` / `not_performed`, and the UI says so.
 */
export type CueTrack = { renditionId: string; audioSha256: string; timing: 'manual'; cues: NarrationCue[] }

const ALIGNED = 'Aligned receiver: the whole message comes back'
const FORMULA = 'Phase error φ scales the recovered message by cos φ'
const HALF = '60° error: half the amplitude is left'
const NULL = '90° error: the message-band part is suppressed'
const RESIDUAL = 'A real filter can leave a small ripple, so 90° is rarely a flat zero'
const FREQUENCY = 'A frequency mismatch makes the recovery drift (not drawn in this scene)'
const CONTROL = 'Check the transmitter, then match the oscillator’s frequency and phase'

const TRACKS: CueTrack[] = [
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

/** The cue track for this exact recording, or null. A re-generated clip gets no stale cues. */
export function cueTrackFor(rendition: Pick<NarrationRendition, 'renditionId' | 'audioSha256'> | null | undefined): CueTrack | null {
  if (!rendition) return null
  return TRACKS.find((t) => t.renditionId === rendition.renditionId && t.audioSha256 === rendition.audioSha256) ?? null
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
export function cueTextRange(track: CueTrack, index: number, text: string): { start: number; end: number } | null {
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
export function readingSplit(track: CueTrack, index: number, seconds: number, clipSeconds: number, text: string): { start: number; readTo: number; end: number } | null {
  const range = cueTextRange(track, index, text)
  if (!range) return null
  const from = track.cues[index].at
  const until = track.cues[index + 1]?.at ?? clipSeconds
  const progress = until > from ? Math.min(1, Math.max(0, (seconds - from) / (until - from))) : 1
  let readTo = range.start + Math.round(progress * (range.end - range.start))
  while (readTo < range.end && readTo > range.start && !/\s/.test(text[readTo])) readTo++
  return { start: range.start, readTo: Math.min(readTo, range.end), end: range.end }
}

/** For checks: every track, read-only. */
export const cueTracks: readonly CueTrack[] = TRACKS
