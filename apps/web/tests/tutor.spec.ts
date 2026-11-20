import { test, expect, type Page } from '@playwright/test';

async function sampleStudent(page: Page) {
  await page.goto('/auth'); await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('link', { name: 'Add your subject', exact: true }).click(); await page.getByLabel('Semester', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
}

const boardItems = (page: Page) => page.getByRole('region', { name: 'Whiteboard' }).locator('[data-item]');
const chip = (page: Page, name: RegExp) => page.getByRole('group', { name: 'Quick replies' }).getByRole('button', { name }).click();

for (const width of [1280, 390]) {
  test(`concept page → tutor → whiteboard → scorecard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await sampleStudent(page);
    await page.goto('/concepts/C-AM-08');
    await page.getByRole('link', { name: /Talk it through with KiKi: Phase error/ }).click();
    await expect(page).toHaveURL(/\/concepts\/C-AM-08\/talk\/ece-phase-error$/);
    await page.getByLabel('English').check();
    await page.getByRole('button', { name: 'Start talking it through' }).click();
    await expect(page.getByText(/do you get all of the message back/).first()).toBeVisible();
    await expect(boardItems(page)).toHaveCount(1);

    await chip(page, /Part of it/);
    await expect(page.locator('[data-item="traces-60"] svg')).toBeVisible();
    await expect(page.locator('[data-item="gain-out"]')).toHaveCount(0);
    await chip(page, /Scales it by cos/);
    await expect(page.locator('[data-item="gain-out"] .katex')).toBeVisible();
    await chip(page, /0\.5, half/);
    await chip(page, /Nothing: cos 90/);
    await expect(page.locator('[data-item="traces-90"] svg path[data-series]')).toHaveCount(3);
    await chip(page, /Use a model sentence/);

    await expect(page.getByRole('heading', { name: 'Your scorecard' })).toBeVisible();
    await expect(page.locator('[data-item="result"]').first()).toBeVisible();
    await expect(page.getByRole('list', { name: 'Stages' }).locator('[data-state="done"]')).toHaveCount(5);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('Odia session shows Odia lines with the machine-draft label', async ({ page }) => {
  await sampleStudent(page);
  await page.goto('/concepts/C-AM-08/talk/ece-phase-error');
  await page.getByLabel('ଓଡ଼ିଆ (Odia)').check();
  await page.getByRole('button', { name: 'Start talking it through' }).click();
  await expect(page.getByText('Machine draft · Odia not reviewed')).toBeVisible();
  await expect(page.locator('li[lang="or"]').first()).toBeVisible();
});
