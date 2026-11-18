import { test, expect, type Page } from '@playwright/test';

async function enroll(page: Page) {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('link', { name: 'Add your subject', exact: true }).click();
  await page.getByLabel('Semester', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
}

for (let n = 1; n <= 10; n++) test(`C-AM-${String(n).padStart(2, '0')} uses dark scope plots and green signals`, async ({ page }) => {
  await enroll(page);
  await page.goto(`/concepts/C-AM-${String(n).padStart(2, '0')}`);
  const steps = page.getByRole('navigation', { name: 'Lesson steps' }).getByRole('button');
  const scene = page.getByRole('region', { name: n === 8 ? 'Phase-recovery teaching scene' : 'CAM concept canvas', exact: true });
  for (const step of [1, 2]) {
    await steps.nth(step).click();
    await expect(scene).toBeVisible();
    if (n === 4 && step === 1 && process.env.KIKI_CANVAS_SCREENSHOT) {
      await page.setViewportSize({ width: 1000, height: 1000 });
      await scene.screenshot({ path: process.env.KIKI_CANVAS_SCREENSHOT });
    }
    const plots = scene.getByRole('img');
    expect(await plots.count()).toBeGreaterThan(0);
    for (const plot of await plots.all()) await expect(plot).toHaveCSS('background-color', 'rgb(19, 25, 20)');
    const signals = n === 8 ? scene.getByTestId('recovered-trace') : scene.locator('svg path[class*="trace"], svg rect[class*="band"]');
    expect(await signals.count()).toBeGreaterThan(0);
    for (const signal of await signals.all()) await expect(signal).toHaveCSS('stroke', 'rgb(121, 223, 149)');
    for (const label of await scene.locator('svg text').all()) await expect(label).toHaveCSS('fill', 'rgb(212, 229, 214)');
    for (const slider of await scene.getByRole('slider').all()) {
      const initial = await slider.inputValue();
      await slider.press('End');
      await expect(slider).toHaveValue((await slider.getAttribute('max'))!);
      await scene.getByRole('button', { name: n === 8 ? 'Reset to lesson example' : 'Reset model', exact: true }).click();
      await expect(slider).toHaveValue(initial);
    }
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
