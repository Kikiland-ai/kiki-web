import { test, expect, chromium, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const root = 'http://127.0.0.1:5174';
const shadow = (page: Page, selector: string) => page.locator('kiki-floating-guidance').locator(selector);
async function bootstrap(page: Page) {
  await page.addInitScript(() => {
    const g = window as unknown as { captureDiagnostics: object; rectDiagnostics: object; videoDiagnostics: object; playError: object; captureTracks: MediaStreamTrack[] };
    const capture = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async options => { const stream = await capture(options); g.captureDiagnostics = stream.getVideoTracks()[0].getSettings(); (g.captureTracks ??= []).push(...stream.getTracks()); return stream; };
    window.addEventListener('message', e => { if (e.data?.type === 'fg_rects') g.rectDiagnostics = { viewport: e.data.viewport, moving: e.data.moving }; });
    const play = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = async function () { try { await play.call(this); } catch (error) { g.playError = { name: (error as Error).name, message: (error as Error).message }; throw error; } setInterval(() => { g.videoDiagnostics = { width: this.videoWidth, height: this.videoHeight, ready: this.readyState }; }, 500); };
  });
  await page.route(`${root}/**`, async route => {
    if (route.request().isNavigationRequest()) {
      const response = await route.fetch({ url: `${root}/tests/lab-screen-share/index.html` });
      await route.fulfill({ response, body: (await response.text()).replace('src="./main.tsx"', 'src="/tests/lab-screen-share/main.tsx"') });
    } else await route.continue();
  });
  await page.goto(`${root}/tests/lab-screen-share/index.html`);
  await page.getByRole('button', { name: 'Open sample student' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Go to my home' }).click();
  await page.getByRole('link', { name: 'Add your subject', exact: true }).click();
  await page.getByLabel('Semester', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
  await page.getByRole('link', { name: 'Lab mode', exact: true }).click();
  await page.getByRole('button', { name: 'Start lab preparation', exact: true }).click();
}
test('real dev extension and Python fake analyzer from React Lab mode', async ({ request }, info) => {
  const profile = await mkdtemp(join(tmpdir(), 'kiki-isolated-lab-'));
  const ext = resolve('test-artifacts/lab-extension');
  // Native tab capture uses the actual window, not Playwright's emulated viewport.
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, viewport: null, args: [
    '--window-size=1280,888',
    `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--enable-usermedia-screen-capturing', '--allow-http-screen-capture', '--auto-select-tab-capture-source-by-title=Kiki target fixture',
  ] });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(20000);
  await context.grantPermissions(['local-network-access'], { origin: root });
  const reader = await context.newPage();
  try {
    const errors: string[] = [];
    const target = context.pages()[0]; target.on('pageerror', error => errors.push(error.message));
    await target.bringToFront();
    await target.goto('http://localhost:8871/');
    await reader.bringToFront();
    reader.on('pageerror', error => errors.push(error.message));
    await bootstrap(reader);
    await expect(reader.getByRole('region', { name: 'Lab connection', exact: true })).toBeVisible();
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const bind = () => worker.evaluate(async () => {
      const g = globalThis as unknown as { chrome: { tabs: { query(q: unknown): Promise<{ id: number }[]> } }; kikiTest: { bind(id: number): Promise<unknown> } };
      const [tab] = await g.chrome.tabs.query({ url: 'http://localhost:8871/*' }); return g.kikiTest.bind(tab.id);
    });
    await bind();
    const share = reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true });
    await request.post('http://127.0.0.1:8002/__test/mode/advance_action');
    await expect(share).toBeEnabled(); await share.click();
    await expect(reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible({ timeout: 20000 });
    const firstAction = await reader.getByTestId('execution-now').innerText();
    await expect.poll(async () => (await (await request.get('http://127.0.0.1:8002/__test/status')).json()).commits.length, { timeout: 30000 }).toBeGreaterThan(0);
    await expect(shadow(target, '.now')).toHaveText(await reader.getByTestId('execution-now').innerText());
    await expect(shadow(target, '.next')).toHaveText(await reader.getByTestId('execution-next').innerText());
    // Two controlled reads support one procedure action; no criterion/score is passed.
    await expect(reader.getByTestId('execution-now')).not.toHaveText(firstAction, { timeout: 35000 });
    await expect(shadow(target, '.now')).toHaveText(await reader.getByTestId('execution-now').innerText());
    await expect(shadow(target, '.next')).toHaveText(await reader.getByTestId('execution-next').innerText());
    const positiveControl = (await target.screenshot({ type: 'jpeg' })).toString('base64');
    const scan = await reader.evaluate(async (images: string[]) => {
      const results: { magenta: number; grey: number }[] = [];
      for (const image of images) {
        let magenta = 0, grey = 0;
        const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + image)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d')!; x.drawImage(bmp, 0, 0);
        const d = x.getImageData(0, 0, bmp.width, bmp.height).data;
        for (let i = 0; i < d.length; i += 4) { if (d[i] > 190 && d[i + 1] < 100 && d[i + 2] > 190) magenta++; if ([d[i], d[i + 1], d[i + 2]].every(n => Math.abs(n - 127) < 8)) grey++; }
        results.push({ magenta, grey });
      }
      return results;
    }, [...(await (await request.get('http://127.0.0.1:8002/__test/status')).json()).images, positiveControl]);
    expect(scan.at(-1)!.magenta).toBeGreaterThan(50);
    for (const image of scan.slice(0, -1)) { expect(image.magenta).toBe(0); expect(image.grey).toBeGreaterThan(2000); }
    await expect(shadow(target, '.canary')).toBeVisible();
    await reader.getByRole('button', { name: 'Pause sharing', exact: true }).click();
    await expect(reader.getByRole('button', { name: 'Resume sharing', exact: true })).toBeVisible();
    await expect(shadow(target, 'button').filter({ hasText: 'Resume guidance' })).toBeEnabled();
    await shadow(target, 'button').filter({ hasText: 'Resume guidance' }).click();
    await expect(reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    await shadow(target, 'button').filter({ hasText: 'Pause guidance' }).click();
    await expect(reader.getByRole('button', { name: 'Resume sharing', exact: true })).toBeVisible();
    await reader.getByRole('button', { name: 'Resume sharing', exact: true }).click();
    await reader.getByRole('button', { name: 'Stop sharing', exact: true }).click();
    await expect(share).toBeVisible(); await target.bringToFront(); await reader.bringToFront(); await share.click();
    await expect(reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    await request.post('http://127.0.0.1:8002/__test/mode/waiting');
    await expect(reader.getByRole('region', { name: 'Lab connection' })).toContainText('The screen reader is waiting', { timeout: 25000 });
    await expect(reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    await target.reload();
    await expect(share).toBeVisible();
    await expect(reader.getByRole('button', { name: 'Pause sharing', exact: true })).toHaveCount(0);
    await target.bringToFront(); await bind(); await reader.bringToFront(); await expect(share).toBeEnabled(); await share.click();
    await expect(reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    await reader.reload();
    await expect(share).toBeVisible();
    await expect(reader.getByRole('button', { name: 'Pause sharing', exact: true })).toHaveCount(0);
    await reader.screenshot({ path: info.outputPath('lab-reconnect.png') });
    for (const width of [320, 390, 768, 1280]) {
      await reader.setViewportSize({ width, height: 900 });
      expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    // After reload, a fresh native share is still explicit; leaving/sign-out releases it.
    await target.bringToFront(); await reader.bringToFront(); await expect(share).toBeEnabled(); await share.click();
    await expect(reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    await reader.getByRole('link', { name: 'Profile', exact: true }).click();
    await reader.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(reader.getByRole('button', { name: 'Open sample student' })).toBeVisible();
    expect(await reader.evaluate(() => (window as unknown as { captureTracks: MediaStreamTrack[] }).captureTracks.every(t => t.readyState === 'ended'))).toBe(true);
    const paths: string[] = (await (await request.get('http://127.0.0.1:8002/__test/status')).json()).recordPaths;
    expect(paths.some(p => /attempts|evidence|mastery/.test(p))).toBe(false);
    expect(errors).toEqual([]);
  } catch (error) {
    console.log('Capture geometry:', await reader.evaluate(() => { const g = window as unknown as { captureDiagnostics: object; rectDiagnostics: object; videoDiagnostics: object; playError: object; captureTracks: MediaStreamTrack[] }; return { capture: g.captureDiagnostics, windows: g.rectDiagnostics, video: g.videoDiagnostics, playError: g.playError }; }));
    console.log('Connection failure state:', await reader.getByRole('region', { name: 'Lab connection' }).innerText().catch(() => 'Panel unavailable'));
    await info.attach('React lab state', { body: await reader.locator('body').innerText(), contentType: 'text/plain' });
    await reader.screenshot({ path: info.outputPath('failure.png') });
    throw error;
  } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
});
