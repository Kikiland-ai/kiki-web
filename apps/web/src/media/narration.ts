// Lesson narration clips (owner: Arpan, media). Uses the lesson contract's own vocabulary
// (contracts/learning.ts `media.narrationKind`, `media.timing`). The contract has one audioUrl
// per lesson; reading along needs one clip per placard and language, so the clips live here
// until the contract carries them.

export type NarrationLang = 'or' | 'en'
export type NarrationKind = 'generated' | 'recorded' | 'fixture'

export interface NarrationClip {
  conceptId: string
  placardId: string
  lang: NarrationLang
  src: string
  /** fixture = a placeholder sound, not speech; generated = machine speech, not yet reviewed. */
  narrationKind: NarrationKind
  reviewed: boolean
  /** Only the clip's own duration is known; there is no sentence alignment, so nothing is highlighted. */
  timing: 'clip_duration_only'
}

const C_AM_08 = ['CARD-AM-08-definition', 'CARD-AM-08-concept', 'CARD-AM-08-application', 'CARD-AM-08-recap']

// Machine speech for C-AM-08 (Gemini 3.8 Flash Lite TTS, Kore), generated 16 Oct with kiki-backend's
// prototypes/mixed_script/speech.py; not yet reviewed. Provenance: c-am-08-narration.provenance.json.
// scripts/make-placeholder-audio.mjs writes labelled placeholders of the same names if needed.
const CLIPS: NarrationClip[] = C_AM_08.flatMap((placardId) =>
  (['or', 'en'] as const).map((lang) => ({
    conceptId: 'C-AM-08',
    placardId,
    lang,
    src: `/audio/sample/C-AM-08/${placardId}.${lang}.wav`,
    narrationKind: 'generated' as const,
    reviewed: false,
    timing: 'clip_duration_only' as const,
  })),
)

export function findNarration(conceptId: string, placardId: string, lang: NarrationLang, clips: NarrationClip[] = CLIPS) {
  return clips.find((c) => c.conceptId === conceptId && c.placardId === placardId && c.lang === lang) ?? null
}

/** Always shown beside the player, so nobody mistakes a placeholder or unreviewed speech for reviewed narration. */
export function narrationLabel(clip: Pick<NarrationClip, 'narrationKind' | 'reviewed'>): string {
  if (clip.narrationKind === 'fixture') return 'Placeholder sound, not narration'
  if (!clip.reviewed) return clip.narrationKind === 'generated' ? 'Sample audio · machine voice, not reviewed' : 'Sample audio · not reviewed'
  return clip.narrationKind === 'generated' ? 'Machine voice' : 'Recorded voice'
}
