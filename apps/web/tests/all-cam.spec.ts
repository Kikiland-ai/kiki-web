import { test, expect, type Page } from '@playwright/test';
import bank from '../src/fixtures/assessment-bank.json' with { type: 'json' };

async function enroll(page: Page) {
  await page.goto('/auth'); await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('link', { name: 'Add your subject', exact: true }).click();
  await page.getByLabel('Semester', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
  await page.getByRole('link', { name: 'Learn', exact: true }).click();
}
for (let n = 1; n <= 10; n++) test(`C-AM-${String(n).padStart(2, '0')}: four placards, media, model, feedback and continuation (sample)`, async ({ page }) => {
  test.setTimeout(60000);
  const cid = `C-AM-${String(n).padStart(2, '0')}`, whole = [4,5,6,7,9,10].includes(n);
  await page.setViewportSize({ width: 390, height: 900 }); await enroll(page);
  await page.getByRole('link', { name: new RegExp(`^Concept ${n}:`) }).click();
  await expect(page).toHaveURL(new RegExp(`/concepts/${cid}$`));
  const dial = page.getByRole('slider', { name: 'Language mix', exact: true });
  await dial.press('Home');
  // English absence is explicit; no unrelated language clip is selected.
  await dial.press('End');
  if (n !== 8) { await expect(page.getByText('No English narration is available for this step. The text is complete.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Listen', exact: true })).toHaveCount(0); }
  await dial.press('Home');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  const audio = page.locator('audio');
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(.1);
  const mediaId = await audio.getAttribute('data-media-id'), blob = await audio.getAttribute('src');
  expect(mediaId).toContain(whole ? `${cid}.concept.or` : '.or');
  await page.getByRole('button', { name: 'Pause narration', exact: true }).click();
  await page.getByRole('slider', { name: 'Position', exact: true }).fill('2');
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(1.9);
  await page.getByRole('button', { name: '1.25×', exact: true }).click();
  expect(await audio.evaluate(el => (el as HTMLAudioElement).playbackRate)).toBe(1.25);
  const steps = page.getByRole('navigation', { name: 'Lesson steps' }).getByRole('button');
  for (let i = 0; i < 4; i++) {
    await steps.nth(i).click();
    await expect(page.getByText(`Step ${i + 1} of 4`, { exact: true })).toBeVisible();
    if (whole) { await expect(audio).toHaveAttribute('data-media-id', mediaId!); expect(await audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(1.9); }
    if (!whole && i > 0) {
      await page.getByRole('button', { name: 'Listen', exact: true }).click();
      await expect(audio).toHaveAttribute('data-media-id', new RegExp(`^CARD-AM-${String(n).padStart(2, '0')}-.*\\.or$`));
      await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(.01);
    }
    if (n === 8) {
      await dial.press('End'); await expect(audio).toHaveCount(0);
      await page.getByRole('button', { name: 'Listen', exact: true }).click();
      await expect(audio).toHaveAttribute('data-media-id', /\.en$/);
      await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(.01);
      await dial.press('Home'); await page.getByRole('button', { name: 'Listen', exact: true }).click();
      await expect(audio).toHaveAttribute('data-media-id', /\.or$/);
    }
    if (i === 1 || i === 2) {
      const region = page.getByRole('region', { name: n === 8 ? 'Phase-recovery teaching scene' : 'CAM concept canvas', exact: true });
      await expect(region).toBeVisible();
      if (n === 4) await expect(page.getByRole('region', { name: 'DSB-SC teaching diagrams' })).toHaveCount(0);
      for (const slider of await region.getByRole('slider').all()) {
        const initial = await slider.inputValue(), max = await slider.getAttribute('max');
        await slider.press('End'); await expect(slider).toHaveValue(max!);
        await region.getByRole('button', { name: n === 8 ? 'Reset to lesson example' : 'Reset model' }).click();
        await expect(slider).toHaveValue(initial);
      }
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 900 });
    }
  }
  await expect(page.getByText('Saving your place…', { exact: true })).toHaveCount(0);
  await page.reload(); await expect(page.getByText('Step 4 of 4', { exact: true })).toBeVisible();
  await expect(dial).toHaveAttribute('aria-valuenow', '1'); await expect(page.locator('audio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(.01);
  const leavingBlob = await audio.getAttribute('src');
  await page.getByRole('link', { name: 'Check this concept', exact: true }).click();
  await expect.poll(() => page.evaluate(url => fetch(url!).then(r => r.ok, () => false), leavingBlob)).toBe(false);
  const set = bank.sets.find(s => s.assessmentId === `AS-AM-${String(n).padStart(2, '0')}`)!;
  // Labelled sample answers only, never used in connected mode.
  for (let i = 0; i < set.questions.length; i++) {
    await page.getByRole('radio').first().check();
    await expect(page.getByText(`Draft saved · ${i + 1}/5 answered`, { exact: true })).toBeVisible();
    if (i < 4) await page.getByRole('button', { name: 'Next question', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Submit check', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Assessment result' })).toBeVisible();
  await expect(page.getByText(/correct —/).first()).toBeVisible();
  await page.goto(`/concepts/${cid}`); await expect(page.getByText('Step 4 of 4', { exact: true })).toBeVisible();
  if (blob) expect(blob).toMatch(/^blob:/);
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(.01);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).paused)).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
  await dial.press('End'); await expect(audio).toHaveCount(0);
  await dial.press('Home'); await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(.01);
  const signoutBlob = await audio.getAttribute('src');
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open sample student' })).toBeVisible();
  await expect.poll(() => page.evaluate(url => fetch(url!).then(r => r.ok, () => false), signoutBlob)).toBe(false);
});
