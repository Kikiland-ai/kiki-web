import { test, expect, chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A whole tutor session driven by voice through the real screen (opt-in).
 *   apps/api: uv run python scripts/tutor_voice_answers.py <dir>/answers.json --env-file <kiki-backend/.env> "…" "…"
 *   apps/api: uv run python scripts/tutor_dev_server.py --env-file <kiki-backend/.env>
 *   apps/web: VITE_TUTOR_DEV_API=http://127.0.0.1:8090 npm run dev
 *   apps/web: KIKI_VOICE_RUN=<dir> npx playwright test tests/tutor-voice-run.spec.ts
 * The page's microphone is replaced by a stream the test feeds: it waits for "Listening", then
 * speaks the next answer. Everything after the microphone is real: worklet → Gemini Live →
 * submit_reply → tutor API → Gemini classifier → engine → Live speaks the brief. Writes KiKi's
 * audio (kiki-voice.wav), the transcripts and each turn's route (run.json) and screenshots.
 */
const dir = process.env.KIKI_VOICE_RUN;
// answers.json holds one spoken answer per probe of ece-am-envelope-design, in this order
const PROBES = ['p-power', 'p-eff', 'p-window', 'p-clip', 'p-choose', 'p-mu09', 'p-explain'];
test.skip(!dir, 'set KIKI_VOICE_RUN to a folder holding answers.json');

const FAKE_MIC = `
(() => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const dest = ctx.createMediaStreamDestination();
  navigator.mediaDevices.getUserMedia = async () => { await ctx.resume(); return dest.stream; };
  window.__say = async (b64, rate) => {
    await ctx.resume();
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    const buf = ctx.createBuffer(1, pcm.length, rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(dest);
    await new Promise(r => { src.onended = r; src.start(); });
  };
})();`;

function wav(chunks: number[][], rate: number) {
  const n = chunks.reduce((s, c) => s + c.length, 0), data = Buffer.alloc(n * 2);
  let o = 0;
  for (const c of chunks) for (const v of c) { data.writeInt16LE(v, o); o += 2; }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

test('a full envelope-design session by voice', async ({ baseURL }) => {
  test.setTimeout(12 * 60_000);
  const { rate, answers } = JSON.parse(readFileSync(join(dir!, 'answers.json'), 'utf8')) as { rate: number; answers: { text: string; pcm: string }[] };
  const shots = join(dir!, 'screens'); mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.addInitScript(FAKE_MIC);
  const turns: unknown[] = [];
  page.on('response', async r => {
    if (r.url().includes('/turns') && r.request().method() === 'POST') {
      try { const b = await r.json(); turns.push({ status: r.status(), sent: JSON.parse(r.request().postData() ?? '{}'), route: b.route, node: b.node, stage: b.stage, modelMs: b.timing?.modelMs, done: b.done }); } catch { /* recorded below */ }
    }
  });

  await page.goto(`${baseURL}/concepts/C-AM-03/talk/ece-am-envelope-design`);
  await page.getByRole('button', { name: 'Open sample student' }).click();
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.getByLabel('English').check();
  await page.getByRole('button', { name: 'Start talking it through' }).click();
  await expect(page.getByText(/how much power sits in the carrier/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Talk by voice' }).click();
  const status = page.locator('[role="status"]').filter({ hasText: /KiKi|Listening|Connecting|Reconnecting/ }).first();

  // answer whatever KiKi is asking now (repeat after a hint or a retry), like a real student would
  const scorecard = page.getByRole('heading', { name: 'Your scorecard' });
  let node = PROBES[0];
  for (let i = 0; i < 16 && !(await scorecard.isVisible()); i++) {
    await expect(status.or(scorecard)).toHaveText(/Listening — answer out loud|Your scorecard/, { timeout: 120_000 });
    if (await scorecard.isVisible()) break;
    const a = answers[PROBES.indexOf(node)];
    await page.waitForTimeout(700);
    const before = turns.length;
    await page.evaluate(([b64, r]) => (window as unknown as { __say: (b: string, r: number) => Promise<void> }).__say(b64 as string, r as number), [a.pcm, rate]);
    await expect.poll(() => turns.length, { timeout: 90_000 }).toBeGreaterThan(before);
    node = (turns[turns.length - 1] as { node: string }).node;
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(shots, `turn-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await expect(scorecard).toBeVisible({ timeout: 120_000 });
  await page.waitForTimeout(13_000);                                       // let KiKi finish the conclusion
  await page.screenshot({ path: join(shots, 'scorecard.png'), fullPage: true });

  const rec = await page.evaluate(() => {
    const r = (window as unknown as { __kikiVoice?: { audio: Int16Array[]; kiki: string[]; student: string[]; turns: number } }).__kikiVoice;
    return r ? { audio: r.audio.map(a => Array.from(a)), kiki: r.kiki, student: r.student, turns: r.turns } : null;
  });
  expect(rec).not.toBeNull();
  writeFileSync(join(dir!, 'kiki-voice.wav'), wav(rec!.audio, 24000));
  writeFileSync(join(dir!, 'run.json'), JSON.stringify({ heard: rec!.student, kikiSaid: rec!.kiki, turns }, null, 1));
  console.log(JSON.stringify(turns.map(t => (t as { route?: { label?: string }; node?: string; modelMs?: number }) && {
    label: (t as { route?: { label?: string } }).route?.label, node: (t as { node?: string }).node, modelMs: (t as { modelMs?: number }).modelMs })));
  expect(turns.length).toBeGreaterThanOrEqual(answers.length);
  expect((turns[turns.length - 1] as { done: boolean }).done).toBe(true);
  await browser.close();
});
