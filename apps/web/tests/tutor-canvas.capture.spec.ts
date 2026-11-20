import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Canvas review captures (opt-in): KIKI_CAPTURE_DIR=<dir> npx playwright test tests/tutor-canvas.capture.spec.ts
 * Screenshots of the whiteboard after every turn on the correct and the misconception paths, at
 * desktop and phone widths, an Odia run, and frames of one progressive reveal.
 */
const dir = process.env.KIKI_CAPTURE_DIR;
test.skip(!dir, 'set KIKI_CAPTURE_DIR');
test.describe.configure({ mode: 'serial' });

const Q = 'ece-am-envelope-design';
const CORRECT = ['pt-59', 'eta-15', 'window-both', 'rcmax-42', 'c-in-window', 'clips-fix', 'tradeoff'];
const MISCONCEPTIONS = ['sideband-no-half', 'eta-equals-mu', 'rc-carrier-only', 'M-AM-01', 'c-above-limit', 'rc-carrier-only', 'vague-tradeoff'];

async function sampleStudent(page: Page) {
  await page.goto('/auth'); await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('link', { name: 'Add your subject', exact: true }).click(); await page.getByLabel('Semester', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
}

async function begin(page: Page, lang: 'en' | 'or') {
  await sampleStudent(page);
  await page.goto(`/concepts/C-AM-03/talk/${Q}`);
  await page.getByLabel(lang === 'or' ? 'ଓଡ଼ିଆ (Odia)' : 'English').check();
  await page.getByRole('button', { name: 'Start talking it through' }).click();
  await expect(page.getByRole('region', { name: 'Whiteboard' }).locator('[data-item]').first()).toBeVisible();
}

async function walk(page: Page, routes: string[], name: string, width: number) {
  const out = join(dir!, name); mkdirSync(out, { recursive: true });
  const board = page.getByRole('region', { name: 'Whiteboard' });
  await board.screenshot({ path: join(out, `00-start-board.png`) });
  await page.screenshot({ path: join(out, `00-start-screen.png`) });
  for (const [i, route] of routes.entries()) {
    const before = await board.locator('[data-item]').count();
    await page.locator(`[data-route="${route}"]`).click();
    await expect.poll(async () => (await page.getByRole('heading', { name: 'Your scorecard' }).isVisible())
      || (await board.locator('[data-item]').count()) > before).toBe(true);
    await page.waitForTimeout(500);                         // let the scroll-to-newest settle
    const n = String(i + 1).padStart(2, '0');
    if (await page.getByRole('heading', { name: 'Your scorecard' }).isVisible()) break;
    await page.screenshot({ path: join(out, `${n}-${route}-screen.png`) });              // what the student sees
    await page.screenshot({ path: join(out, `${n}-${route}-page.png`), fullPage: true });  // the whole page
    if (width >= 1024) await board.screenshot({ path: join(out, `${n}-${route}-board.png`) });
  }
  await expect(page.getByRole('heading', { name: 'Your scorecard' })).toBeVisible();
  await page.screenshot({ path: join(out, `99-scorecard-page.png`), fullPage: true });
}

for (const width of [1440, 1280, 1024, 390]) {
  test(`correct path at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await begin(page, 'en');
    await walk(page, CORRECT, `correct-${width}`, width);
  });
}

test('misconception path at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await begin(page, 'en');
  await walk(page, MISCONCEPTIONS, 'misconceptions-1280', 1280);
});

test('Odia correct path at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await begin(page, 'or');
  await walk(page, CORRECT, 'odia-1280', 1280);
});

for (const width of [1280, 390]) {
  test(`progressive reveal frames at ${width}px (finishing "power", entering the RC window)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await begin(page, 'en');
    const out = join(dir!, `reveal-frames-${width}`); mkdirSync(out, { recursive: true });
    await page.locator('[data-route="pt-59"]').click();
    await page.waitForTimeout(3500);
    await page.locator('[data-route="eta-15"]').click();
    const t0 = Date.now();
    for (const ms of [0, 200, 450, 700, 1000, 1400, 1800, 2600, 3400]) {
      const wait = ms - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      await page.screenshot({ path: join(out, `t${String(ms).padStart(4, '0')}ms.png`) });
    }
  });
}
