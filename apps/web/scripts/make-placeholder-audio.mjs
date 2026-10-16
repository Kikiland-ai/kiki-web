// Writes the labelled placeholder narration clips for C-AM-08 (not speech: a soft chime every
// 2 s for 8 s). Usage, from apps/web: node scripts/make-placeholder-audio.mjs
// The committed clips are generated speech (see src/media/narration.ts); run this only to fall back to
// placeholders, and set narrationKind to 'fixture' so the label says so.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RATE = 8000
const SECONDS = 8
const placards = ['CARD-AM-08-definition', 'CARD-AM-08-concept', 'CARD-AM-08-application', 'CARD-AM-08-recap']
const out = join('public', 'audio', 'sample', 'C-AM-08')
mkdirSync(out, { recursive: true })

function wav(pitch) {
  const samples = RATE * SECONDS
  const buffer = Buffer.alloc(44 + samples)
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples, 4); buffer.write('WAVE', 8)
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(RATE, 24); buffer.writeUInt32LE(RATE, 28); buffer.writeUInt16LE(1, 32); buffer.writeUInt16LE(8, 34)
  buffer.write('data', 36); buffer.writeUInt32LE(samples, 40)
  for (let i = 0; i < samples; i++) {
    const t = (i / RATE) % 2 // a 0.25 s chime at the start of every 2 s
    const level = t < 0.25 ? 0.18 * Math.sin((Math.PI * t) / 0.25) : 0
    buffer.writeUInt8(Math.round(128 + 127 * level * Math.sin((2 * Math.PI * pitch * i) / RATE)), 44 + i)
  }
  return buffer
}

for (const placard of placards) {
  writeFileSync(join(out, `${placard}.or.wav`), wav(523))
  writeFileSync(join(out, `${placard}.en.wav`), wav(659))
}
console.log(`Wrote ${placards.length * 2} placeholder clips to ${out}`)
