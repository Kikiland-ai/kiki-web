import { test, expect, type Page } from '@playwright/test';
async function openDiagram(page: Page) {
  await page.goto('/auth'); await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('link', { name: 'Add your subject', exact: true }).click();
  await page.getByLabel('Semester', { exact: true }).selectOption('3'); await page.getByRole('button', { name: 'Add subject', exact: true }).click();
  await page.getByRole('link', { name: 'Learn', exact: true }).click(); await page.getByRole('link', { name: /^Concept 4:/ }).click();
  await page.getByRole('navigation', { name: 'Lesson steps' }).getByRole('button').nth(1).click();
  await expect(page.getByText('Saving your place…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'CAM concept canvas' })).toBeVisible();
}
test('shared DSB exploration predicts sidebands without awarding a score', async ({ page }) => {
  await openDiagram(page); const canvas = page.getByRole('region', { name: 'CAM concept canvas' });
  await expect(canvas.locator('output').nth(0)).toHaveText('1900 Hz'); await expect(canvas.locator('output').nth(1)).toHaveText('2100 Hz');
  const saved = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  const slider = canvas.getByRole('slider', { name: /Message frequency/ }); await slider.press('End');
  await expect(canvas.locator('output').nth(0)).toHaveText('1800 Hz'); await expect(canvas.locator('output').nth(1)).toHaveText('2200 Hz');
  await slider.press('Home'); await expect(canvas.locator('output').nth(0)).toHaveText('1990 Hz');
  await canvas.getByRole('button', { name: 'Reset model' }).click(); await expect(canvas.locator('output').nth(0)).toHaveText('1900 Hz');
  await expect(canvas.getByRole('note').filter({ hasText: 'carrier is fixed at 2000 Hz' })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(saved);
  await page.getByRole('link', { name: 'Learn', exact: true }).click(); await expect(page.getByRole('progressbar', { name: 'Concept checks passed' })).toHaveAttribute('value', '0');
  await page.getByRole('link', { name: /^Concept 4:/ }).click(); await expect(page.getByText('Step 2 of 4', { exact: true })).toBeVisible();
});
test('the existing glossary opens beside the shared canvas and restores focus', async ({ page }) => {
  await openDiagram(page);
  const word = page.getByRole('region', { name: 'Words in this lesson' }).getByRole('button', { name: 'sideband', exact: true });
  await word.click(); const sheet = page.getByRole('dialog', { name: 'sideband', exact: true });
  await expect(sheet.getByText('ସାଇଡ୍ବ୍ୟାଣ୍ଡ୍', { exact: true })).toBeVisible(); await expect(sheet.getByText('Odia meaning', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await expect(word).toBeFocused();
});
for (const width of [320,390,768,1024,1440]) test(`shared DSB canvas and glossary fit ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await openDiagram(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('region', { name: 'Words in this lesson' }).getByRole('button', { name: 'sideband', exact: true }).click();
  const sheet = page.getByRole('dialog'); await expect(sheet).toBeVisible();
  await expect.poll(async () => { const b = await sheet.boundingBox(); return b!.x + b!.width; }).toBeLessThanOrEqual(width + 1);
  expect(await sheet.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
});
