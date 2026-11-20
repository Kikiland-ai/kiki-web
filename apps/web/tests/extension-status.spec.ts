import { test, expect } from '@playwright/test';

// Sample UI and protocol doubles; no Google or real extension install.
for (const width of [390, 1280]) {
  test(`extension health and update controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.addInitScript(() => {
      const fixture = window as Window & { fixtureVersion?: string };
      fixture.fixtureVersion = '0.1.4';
      window.addEventListener('message', event => {
        const m = event.data;
        if (event.source === window && m?.channel === 'kiki-floating-guidance' && m.direction === 'page' && m.type === 'reader_status' && fixture.fixtureVersion) window.postMessage({ channel: m.channel, direction: 'extension', type: 'extension_status', request_id: m.request_id, version: fixture.fixtureVersion }, location.origin);
      });
    });
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Open sample student' }).click();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
    await page.getByRole('button', { name: 'Go to my home' }).click();
    const green = page.getByRole('button', { name: 'Lab extension is up to date', exact: true });
    await expect(green).toBeVisible();
    const iconBox = await green.boundingBox(), labBox = await page.getByRole('link', { name: 'Lab mode', exact: true }).boundingBox();
    expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(labBox!.x);
    await green.click(); await expect(page.getByText('Your Lab extension is ready. No installation needed.')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(green).toBeFocused();
    await page.evaluate(() => { (window as Window & { fixtureVersion?: string }).fixtureVersion = '0.1.3'; window.dispatchEvent(new Event('focus')); });
    const yellow = page.getByRole('button', { name: 'Lab extension update required', exact: true });
    await yellow.click();
    await expect(page.getByRole('link', { name: 'Download latest extension' })).toHaveAttribute('href', '/lab-extension/kiki-lab-extension.zip');
    await expect(page.getByText(/Do not load a second copy/)).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/extension-status-${width}.png` });
    await page.keyboard.press('Escape');
    await page.evaluate(() => { (window as Window & { fixtureVersion?: string }).fixtureVersion = undefined; window.dispatchEvent(new Event('focus')); });
    await expect(page.getByRole('button', { name: 'Lab extension not detected — install or enable', exact: true })).toBeVisible();
  });
}

test('isolated browser without extension shows install action and serves the release package', async ({ page }) => {
  // Directory picker double: no real user folder permission or files touched.
  await page.addInitScript(() => {
    const files = new Map<string, Uint8Array>();
    Object.defineProperty(window, 'showDirectoryPicker', { value: async () => ({
      async *entries() { for (const entry of files.entries()) yield entry; },
      async removeEntry(name: string) { files.delete(name); },
      async getFileHandle(name: string) { return { createWritable: async () => ({ write: async (data: Uint8Array) => { files.set(name, data); (window as Window & { preparedNames?: string[] }).preparedNames = [...files.keys()]; }, close: async () => {} }) }; },
    }) });
  });
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('button', { name: 'Lab extension not detected — install or enable', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download latest extension' })).toBeVisible();
  const latest = await page.request.get('/lab-extension/latest.json');
  expect(await latest.json()).toEqual({ version: '0.1.4' });
  const zip = await page.request.get('/lab-extension/kiki-lab-extension.zip');
  expect(zip.ok()).toBe(true);
  expect((await zip.body()).subarray(0, 2).toString()).toBe('PK');
  await page.getByRole('button', { name: 'Prepare extension folder', exact: true }).click();
  await expect(page.getByText(/^Files ready\./)).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { preparedNames?: string[] }).preparedNames)).toContain('manifest.json');
  await expect(page.getByRole('button', { name: 'Copy extensions address' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload Kiki' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.extension-status-button').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.screenshot({ path: 'test-results/extension-status-local-missing.png' });
});
