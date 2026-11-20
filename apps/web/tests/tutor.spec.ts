import { test, expect, type Page } from '@playwright/test';

async function sampleStudent(page: Page) {
  await page.goto('/auth'); await page.getByRole('button', { name: 'Open sample student' }).click();
  await page.getByRole('button', { name: 'Start learning' }).click();
  // A new student on the prepared path opens the chapter map first
  await expect(page).toHaveURL(/\/chapters\/LP-ANALOG-MODULATION$/);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
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

test('the tutor is reachable from Home, Subject and Checks through the /talk hub', async ({ page }) => {
  await sampleStudent(page);
  await page.goto('/home');
  await page.getByRole('link', { name: /Talk it through with KiKi/ }).click();
  await expect(page).toHaveURL(/\/talk$/);
  await expect(page.getByRole('heading', { name: 'Talk it through with KiKi' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Questions to talk through' }).getByRole('link')).toHaveCount(3);
  await page.getByRole('link', { name: /Designing an AM envelope detector/ }).click();
  await expect(page).toHaveURL(/\/concepts\/C-AM-03\/talk\/ece-am-envelope-design$/);
  await expect(page.getByRole('button', { name: 'Start talking it through' })).toBeVisible();
  await page.goto('/subjects/CRS-AC-ECE');
  await expect(page.getByRole('link', { name: 'Talk it through' })).toHaveAttribute('href', '/talk');
  await page.goto('/practice');
  await expect(page.getByRole('link', { name: /Choose a problem/ })).toHaveAttribute('href', '/talk');
});

test('a tutor link opened signed out survives sign-in and onboarding', async ({ page }) => {
  const link = '/concepts/C-AM-03/talk/ece-am-envelope-design';
  await page.goto(link);
  await expect(page).toHaveURL(/\/auth\?returnTo=%2Fconcepts%2FC-AM-03%2Ftalk%2Fece-am-envelope-design$/);
  await page.getByRole('button', { name: 'Open sample student' }).click();
  await page.getByRole('button', { name: 'Start learning' }).click();
  await expect(page).toHaveURL(new RegExp(`${link}$`));
  await expect(page.getByRole('button', { name: 'Start talking it through' })).toBeVisible();
});

test('Odia session shows Odia lines with the machine-draft label', async ({ page }) => {
  await sampleStudent(page);
  await page.goto('/concepts/C-AM-08/talk/ece-phase-error');
  await page.getByLabel('ଓଡ଼ିଆ (Odia)').check();
  await page.getByRole('button', { name: 'Start talking it through' }).click();
  await expect(page.getByText('Machine draft · Odia not reviewed')).toBeVisible();
  await expect(page.locator('li[lang="or"]').first()).toBeVisible();
});
