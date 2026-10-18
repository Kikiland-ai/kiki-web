import { test, expect } from '@playwright/test';

test('synthetic lab input preserves a failed draft, requires explicit confirmation and blocks a changed context', async ({ page }) => {
  await page.goto('/tests/lab-input/index.html');
  await expect(page.getByRole('heading', { name: 'Synthetic lab input UI check' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle API failure' }).click();
  await page.getByLabel('Your own words').fill('My explicitly labelled synthetic observation.');
  await page.getByRole('button', { name: 'Record response' }).click();
  await expect(page.getByRole('status')).toContainText('draft is kept');
  await expect(page.getByLabel('Your own words')).toHaveValue('My explicitly labelled synthetic observation.');
  await page.getByRole('button', { name: 'Toggle API failure' }).click();
  await page.getByRole('button', { name: 'Record response' }).click();
  await expect(page.getByTestId('submission-count')).toHaveText('Confirmed submissions: 1');
  await expect(page.getByLabel('Your own words')).toHaveValue('');
  const boxes = page.getByRole('checkbox'); await expect(boxes).toHaveCount(2);
  await expect(boxes.nth(0)).not.toBeChecked(); await expect(boxes.nth(1)).not.toBeChecked();
  await boxes.nth(0).focus(); await page.keyboard.press('Space');
  await page.getByLabel('What evidence did you review?').fill('I checked this synthetic workspace only.');
  await page.getByRole('button', { name: 'Confirm selected criteria' }).click();
  await expect(page.getByTestId('submission-count')).toHaveText('Confirmed submissions: 2');
  await page.getByLabel('Your own words').fill('A draft for the old screen context.');
  await page.getByRole('button', { name: 'Change screen context' }).click();
  await expect(page.getByRole('button', { name: 'Record response' })).toBeDisabled();
  await expect(page.getByLabel('Your own words')).toHaveValue('A draft for the old screen context.');
  await page.getByRole('button', { name: 'Use current step' }).click();
  await expect(page.getByLabel('Your own words')).toHaveValue('');
  await expect(page.getByTestId('submission-count')).toHaveText('Confirmed submissions: 2');
});

for (const width of [320, 390, 768, 1280]) test(`synthetic lab input fits ${width}px and has keyboard-sized inputs`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto('/tests/lab-input/index.html');
  await expect(page.getByLabel('Your own words')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const input of await page.locator('textarea, select').all()) {
    const box = await input.boundingBox(); expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
  await page.screenshot({ path: `test-artifacts/lab-input-${width}.png`, fullPage: true });
});
