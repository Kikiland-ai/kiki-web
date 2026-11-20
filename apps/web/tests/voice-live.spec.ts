import { test, expect, chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Real-browser voice check against Gemini Live (opt-in). Prepare with
 *   apps/api: uv run python scripts/tutor_voice_browser_prep.py <dir> "<student sentence>"
 * then run with KIKI_VOICE_DIR=<dir> npx playwright test tests/voice-live.spec.ts
 * Chromium's fake microphone plays <dir>/student.wav into the real mic → worklet → Live path.
 */
const dir = process.env.KIKI_VOICE_DIR;
test.skip(!dir, 'set KIKI_VOICE_DIR (see the comment above)');

test('browser mic → Live → submit_reply → KiKi speaks the returned brief', async ({ baseURL }) => {
  test.setTimeout(90_000);
  const { token, model } = JSON.parse(readFileSync(join(dir!, 'token.json'), 'utf8'));
  const browser = await chromium.launch({ args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${join(dir!, 'student.wav')}`, '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();
  await page.goto(`${baseURL}/tests/voice-harness/index.html?token=${encodeURIComponent(token)}&model=${model}`);
  await expect.poll(() => page.evaluate(() => (window as unknown as { voiceResult: { done: boolean; errors: string[] } }).voiceResult.done
    || (window as unknown as { voiceResult: { errors: string[] } }).voiceResult.errors.length > 0), { timeout: 75_000 }).toBe(true);
  const r = await page.evaluate(() => (window as unknown as { voiceResult: Record<string, unknown> }).voiceResult);
  console.log(JSON.stringify(r));
  expect(r.errors).toEqual([]);
  expect(r.ready).toBe(true);
  expect(r.micChunks as number).toBeGreaterThan(10);
  expect(r.toolCalls).toBe(1);
  expect(String(r.heard).toLowerCase()).toMatch(/part/);
  expect((r.kikiSaid as string[])[0]).toMatch(/part of it, or none/i);
  expect((r.kikiSaid as string[]).at(-1)).toMatch(/how does the phase error change the output/i);
  expect(r.kikiAudioChunks as number).toBeGreaterThan(5);
  await browser.close();
});
