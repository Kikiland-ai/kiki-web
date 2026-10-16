import { test, expect, type Page } from '@playwright/test';
const file = { name: 'class-notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nOriginal test bytes.\n%%EOF') };
async function setup(page: Page) {
  await page.goto('/auth'); await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('link', { name: 'Add your subject', exact: true }).click();
  await page.getByLabel('Semester', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
  await page.goto('/subjects/CRS-AC-ECE/material');
}
async function save(page: Page) {
  await page.locator('#material-files').setInputFiles(file);
  await page.getByRole('button', { name: 'Save material in preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your files are saved.', exact: true })).toBeVisible();
}
test('originals and outline survive refresh, leave/return, retry, confirmation and logout', async ({ page }) => {
  await setup(page); await save(page);
  const requestUrl = page.url();
  await page.getByRole('link', { name: 'Library', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Your Library' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Open request' })).toBeVisible();
  await page.getByRole('link', { name: 'Open request' }).click();
  await expect(page).toHaveURL(requestUrl);
  await page.getByRole('button', { name: 'Preview reading failure' }).click();
  await page.getByRole('button', { name: 'Retry reading' }).click();
  await page.getByRole('button', { name: 'Preview sample outline' }).click();
  await page.getByLabel('Chapter title', { exact: true }).fill('My Analog Modulation notes');
  await page.getByRole('button', { name: 'Confirm outline and prepare lessons' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your outline is confirmed.' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview ready state' }).click();
  await expect(page.getByRole('heading', { name: 'My Analog Modulation notes', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open original', exact: true }).click();
  await expect(page.getByRole('heading', { name: file.name, exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download original' }).click();
  expect((await download).suggestedFilename()).toBe(file.name);
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open sample student' })).toBeVisible();
  await page.goto('/library');
  await expect(page.getByRole('button', { name: 'Open sample student' })).toBeVisible();
});
test('invalid files do not discard valid attachments and an empty outline cannot submit', async ({ page }) => {
  await setup(page);
  await page.locator('#material-files').setInputFiles([file, { name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('bad header') }]);
  await expect(page.getByRole('alert')).toContainText('does not match');
  await expect(page.getByText(file.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save material in preview' }).click();
  await page.getByRole('button', { name: 'Preview sample outline' }).click();
  for (const box of await page.getByRole('checkbox').all()) await box.uncheck();
  await expect(page.getByRole('button', { name: 'Confirm outline and prepare lessons' })).toBeDisabled();
});
test('phone image originals render, long names wrap, and intake does not award learning evidence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page);
  const name = 'ଓଡ଼ିଆ-class-notes-with-a-long-name-for-Analog-Modulation.png';
  await page.locator('#material-files').setInputFiles({ name, mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6Zl8AAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Save material in preview' }).click();
  await page.getByRole('link', { name: 'Open original', exact: true }).click();
  const image = page.getByRole('img', { name: `Original document: ${name}` });
  await expect(image).toBeVisible();
  expect(await image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByText('Not assessed', { exact: true })).toHaveCount(4);
});
for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440]) {
  test(`material flow has no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await save(page);
    await page.getByRole('button', { name: 'Preview sample outline' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole('link', { name: 'Library', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Your Library' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
