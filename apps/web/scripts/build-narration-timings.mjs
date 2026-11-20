// Builds sentence timings for every narrated clip, from the pauses in the recordings.
//
//   node scripts/build-narration-timings.mjs          write src/features/learning/narrationTimings.json
//   node scripts/build-narration-timings.mjs --check  compare with the hand-placed C-AM-08 cues and exit
//
// For each rendition in the sample media manifests it:
//   1. rebuilds the exact text the clip reads (its placards' body text, joined by a space) and checks
//      it against the manifest's sourceTextSha256, so timings are only made for the text the audio speaks;
//   2. splits that text into sentences (per placard, so whole-concept clips know which card each is on);
//   3. finds the pauses in the 16-bit mono WAV (10 ms frames, quiet relative to the clip's loudness);
//   4. picks one pause per sentence boundary with dynamic programming: boundaries fall near where the
//      text's length says they should, and longer pauses are preferred.
// The result is keyed to each clip's exact audio hash; a re-generated clip gets no stale timings.
// This is sentence-level timing from pauses, not word alignment.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = join(dirname(fileURLToPath(import.meta.url)), '..')
const assets = join(web, '..', '..', 'data-model', 'media', 'all-cam', 'assets')
const lessons = JSON.parse(readFileSync(join(web, 'src/fixtures/learning-content.json'), 'utf8')).lessons
const manifests = readdirSync(join(web, 'src/fixtures/all-cam')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(web, 'src/fixtures/all-cam', f), 'utf8')).manifest)

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** Sentences of one placard's text: start offset in that text and the opening words. */
function sentences(text) {
  const out = []
  const re = /[^.!?।]+(?:[.!?।]+|$)/gu
  let m
  while ((m = re.exec(text))) {
    const raw = m[0]
    const lead = raw.length - raw.trimStart().length
    const body = raw.trim()
    if (body.replace(/[.!?।\s]/gu, '').length < 2) continue
    // A decimal point or abbreviation would split mid-sentence: join fragments that start lower-case or with a digit
    const start = m.index + lead
    if (out.length && /^[a-z0-9(]/.test(body) && !/[।]$/.test(text.slice(out.at(-1).start, start).trim())) {
      out.at(-1).length = start + body.length - out.at(-1).start
      continue
    }
    out.push({ start, length: body.length, from: body.split(/\s+/).slice(0, 4).join(' ') })
  }
  return out
}

/** PCM samples of a 16-bit mono WAV. */
function readWav(file) {
  const buf = readFileSync(file)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file} is not a WAV`)
  let p = 12, rate = 0, bits = 0, channels = 0
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), size = buf.readUInt32LE(p + 4)
    if (id === 'fmt ') { channels = buf.readUInt16LE(p + 10); rate = buf.readUInt32LE(p + 12); bits = buf.readUInt16LE(p + 22) }
    if (id === 'data') {
      if (bits !== 16 || channels !== 1) throw new Error(`${file}: expected 16-bit mono, got ${bits}-bit ${channels}ch`)
      return { rate, samples: new Int16Array(buf.buffer.slice(buf.byteOffset + p + 8, buf.byteOffset + p + 8 + size)) }
    }
    p += 8 + size + (size % 2)
  }
  throw new Error(`${file}: no data chunk`)
}

/** Speech onset, speech end and the pauses (start, end) between, in seconds. */
function pauses({ rate, samples }) {
  const frame = Math.round(rate * 0.01)
  const rms = []
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let s = 0
    for (let j = i; j < i + frame; j++) s += samples[j] * samples[j]
    rms.push(Math.sqrt(s / frame))
  }
  const sorted = [...rms].sort((a, b) => a - b)
  const loud = sorted[Math.floor(sorted.length * 0.95)]
  const quiet = (v) => v < loud * 0.06
  const first = rms.findIndex((v) => !quiet(v)), last = rms.length - 1 - [...rms].reverse().findIndex((v) => !quiet(v))
  const gaps = []
  for (let i = first; i <= last; i++) {
    if (!quiet(rms[i])) continue
    let j = i
    while (j <= last && quiet(rms[j])) j++
    if (j - i >= 12) gaps.push({ start: i / 100, end: j / 100 })
    i = j
  }
  return { onset: first / 100, end: (last + 1) / 100, gaps }
}

/** One pause per boundary, in order: near the length-based estimate, preferring long pauses. */
function align(weights, speech) {
  const total = weights.reduce((a, b) => a + b, 0)
  const span = speech.end - speech.onset
  let acc = 0
  const est = weights.slice(0, -1).map((w) => { acc += w; return speech.onset + (span * acc) / total })
  const G = speech.gaps, K = est.length
  if (K === 0) return []
  if (G.length < K) return null
  const sigma = Math.max(0.6, span * 0.06)
  const cost = (k, g) => ((G[g].end - est[k]) / sigma) ** 2 - 2.2 * Math.log(1 + (G[g].end - G[g].start) / 0.12)
  // best[k][g]: lowest cost with boundary k on gap g
  const best = Array.from({ length: K }, () => new Array(G.length).fill(Infinity))
  const from = Array.from({ length: K }, () => new Array(G.length).fill(-1))
  for (let g = 0; g < G.length; g++) best[0][g] = cost(0, g)
  for (let k = 1; k < K; k++) {
    let run = Infinity, arg = -1
    for (let g = 0; g < G.length; g++) {
      if (g - 1 >= 0 && best[k - 1][g - 1] < run) { run = best[k - 1][g - 1]; arg = g - 1 }
      if (arg >= 0) { best[k][g] = run + cost(k, g); from[k][g] = arg }
    }
  }
  let g = best[K - 1].indexOf(Math.min(...best[K - 1]))
  const picked = []
  for (let k = K - 1; k >= 0; k--) { picked.unshift(G[g]); g = from[k][g] }
  return picked.map((gap) => +(Math.max(gap.start, gap.end - 0.08)).toFixed(2))
}

const tracks = [], skipped = []
for (const manifest of manifests) {
  const lesson = lessons[manifest.conceptId]
  for (const r of manifest.narration) {
    const ids = 'scope' in r ? r.placardIds : [r.placardId]
    const texts = ids.map((id) => lesson?.placards.find((p) => p.id === id)?.body[r.lang])
    if (texts.some((t) => t === undefined)) { skipped.push(`${r.renditionId}: text not found`); continue }
    if (sha256(Buffer.from(texts.join(' '), 'utf8')) !== r.sourceTextSha256) { skipped.push(`${r.renditionId}: text does not match the audio's source text`); continue }
    const wav = join(assets, `${r.assetId}.wav`)
    if (!existsSync(wav)) { skipped.push(`${r.renditionId}: audio not found`); continue }
    const audio = readWav(wav)
    if (sha256(readFileSync(wav)) !== r.audioSha256) { skipped.push(`${r.renditionId}: audio hash differs`); continue }
    const parts = ids.flatMap((placardId, i) => sentences(texts[i]).map((s) => ({ ...s, placardId })))
    const speech = pauses(audio)
    const starts = align(parts.map((s) => s.length), speech)
    if (!starts) { skipped.push(`${r.renditionId}: fewer pauses than sentences`); continue }
    const at = [+(Math.max(0, speech.onset - 0.05)).toFixed(2), ...starts]
    tracks.push({
      renditionId: r.renditionId, audioSha256: r.audioSha256,
      sentences: parts.map((s, i) => ({ at: at[i], placardId: s.placardId, start: s.start, from: s.from })),
    })
  }
}

if (process.argv.includes('--check')) {
  // --check <hand.json>: [{ renditionId, audioSha256, cues: [{ at, from }] }] exported from narrationCues.ts
  const hand = JSON.parse(readFileSync(process.argv[process.argv.indexOf('--check') + 1], 'utf8'))
  for (const h of hand) {
    const g = tracks.find((t) => t.renditionId === h.renditionId && t.audioSha256 === h.audioSha256)
    if (!g) { console.log(h.renditionId, 'no generated track'); continue }
    for (const c of h.cues) {
      const match = g.sentences.find((s) => s.from.startsWith(c.from.split(' ')[0]) && Math.abs(s.at - c.at) < 4) ?? null
      console.log(`${h.renditionId.padEnd(28)} hand ${String(c.at).padStart(5)}  pauses ${match ? String(match.at).padStart(5) : '    -'}  ${match ? `Δ ${(match.at - c.at).toFixed(2)}` : '(sentence split differs)'}  "${c.from}"`)
    }
  }
} else {
  const out = { generator: 'scripts/build-narration-timings.mjs', timing: 'pauses', note: 'Sentence starts found from pauses in each recording; not word alignment.', tracks }
  writeFileSync(join(web, 'src/features/learning/narrationTimings.json'), JSON.stringify(out, null, 1) + '\n')
  console.log(`${tracks.length} tracks, ${tracks.reduce((n, t) => n + t.sentences.length, 0)} sentences`)
}
if (skipped.length) console.log('skipped:\n  ' + skipped.join('\n  '))
