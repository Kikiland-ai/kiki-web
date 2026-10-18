import { test, expect, chromium, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const root = 'http://127.0.0.1:5174';
const shadow = (page: Page, selector: string) => page.locator('kiki-floating-guidance').locator(selector);
test.beforeEach(async ({ request }) => { expect((await request.post('http://127.0.0.1:8002/__test/reset')).ok()).toBe(true); });

async function isolatedLab() {
  const profile = await mkdtemp(join(tmpdir(), 'kiki-local-integration-'));
  const ext = resolve('test-artifacts/lab-extension');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, viewport: null, args: [
    '--window-size=1280,888', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`,
    '--enable-usermedia-screen-capturing', '--allow-http-screen-capture', '--auto-select-tab-capture-source-by-title=Kiki target fixture',
  ] });
  await context.grantPermissions(['local-network-access'], { origin: root });
  const target = context.pages()[0]; await target.goto('http://localhost:8871/');
  const reader = await context.newPage(); await bootstrap(reader);
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    const g = globalThis as unknown as { chrome: { tabs: { query(q: unknown): Promise<{ id: number }[]> } }; kikiTest: { bind(id: number): Promise<unknown> } };
    const [tab] = await g.chrome.tabs.query({ url: 'http://localhost:8871/*' }); return g.kikiTest.bind(tab.id);
  });
  return { reader, target, worker, close: async () => { await context.close(); await rm(profile, { recursive: true, force: true }); } };
}

test('floating Resume waits for the delayed final page Pause read', async () => {
  const lab = await isolatedLab(); let release = () => {};
  try {
    await lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true }).click();
    await expect(lab.reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    let gets = 0, held = false;
    const gate = new Promise<void>(resolve => release = resolve);
    await lab.reader.route('**/lab-preparations/*/execution', async route => {
      if (route.request().method() === 'GET' && ++gets === 2) { held = true; await gate; }
      await route.continue();
    });
    await lab.reader.getByRole('button', { name: 'Pause sharing', exact: true }).click();
    await expect.poll(() => held).toBe(true);
    const resume = shadow(lab.target, 'button').filter({ hasText: 'Resume guidance' });
    await expect(resume).toBeEnabled(); await resume.click(); release();
    await expect(lab.reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    await expect(shadow(lab.target, '[role=alert]')).not.toContainText('Use the controls in Lab mode to reconnect.');
    await expect(shadow(lab.target, '.now')).toHaveText(await lab.reader.getByTestId('execution-now').innerText());
    await lab.reader.getByRole('button', { name: 'Stop sharing', exact: true }).click();
  } finally { release(); await lab.close(); }
});

test('rechecks, route replacement, worker restart and another reader preserve explicit ownership and sharing', async () => {
  const lab = await isolatedLab();
  try {
    const identity = () => lab.worker.evaluate(async () => (globalThis as unknown as { kikiTest: { state(): Promise<{ controller: { stream_id: string; generation: number } }> } }).kikiTest.state().then(s => s.controller));
    await expect(lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true })).toBeEnabled();
    await expect.poll(identity).not.toBeNull();
    const initial = await identity();
    for (let i = 0; i < 3; i++) await lab.reader.getByRole('button', { name: 'Check Kiki extension', exact: true }).click();
    await expect.poll(identity).toEqual(initial);
    await lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true }).click();
    await expect(lab.reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    const path = lab.reader.url();
    await lab.reader.getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(lab.reader).toHaveURL(/\/profile$/);
    await expect(lab.reader.getByRole('region', { name: 'Lab connection', exact: true })).toHaveCount(0);
    await lab.reader.goBack();
    await expect(lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true })).toBeVisible();
    await expect.poll(async () => (await identity()).generation).toBeGreaterThan(initial.generation);
    const beforeRestart = await identity();
    const protocol = await lab.reader.context().newCDPSession(lab.reader);
    const hellos = await lab.reader.evaluate(() => (window as unknown as { helloDiagnostics: { count: number } }).helloDiagnostics.count);
    const targets = (await protocol.send('Target.getTargets')).targetInfos;
    const extensionWorker = targets.find(t => t.type === 'service_worker' && t.url.endsWith('/background.js'));
    expect(extensionWorker).toBeTruthy();
    expect((await protocol.send('Target.closeTarget', { targetId: extensionWorker!.targetId })).success).toBe(true);
    // A normal content-bridge recheck restarts the worker; storage.session retains identity.
    await lab.reader.getByRole('button', { name: 'Check Kiki extension', exact: true }).click();
    await expect(lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true })).toBeEnabled();
    await expect.poll(() => lab.reader.evaluate(() => (window as unknown as { helloDiagnostics: { count: number } }).helloDiagnostics.count)).toBeGreaterThan(hellos);
    const restarted = await lab.reader.evaluate(() => (window as unknown as { helloDiagnostics: { stream_id: string; generation: number } }).helloDiagnostics);
    expect(restarted).toMatchObject({ stream_id: beforeRestart.stream_id, generation: beforeRestart.generation }); await protocol.detach();
    await lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true }).click();
    await expect(lab.reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    const session = await lab.reader.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    const replacement = await lab.reader.context().newPage();
    await replacement.addInitScript(values => { for (const [key, value] of Object.entries(values)) sessionStorage.setItem(key, value); }, session);
    await bootstrap(replacement, path);
    await expect(lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true })).toBeVisible();
    await expect(lab.reader.getByRole('button', { name: 'Pause sharing', exact: true })).toHaveCount(0);
    expect(await lab.reader.evaluate(() => (window as unknown as { captureTracks: MediaStreamTrack[] }).captureTracks.every(t => t.readyState === 'ended'))).toBe(true);
    await expect(replacement.getByRole('button', { name: 'Share your MATLAB tab', exact: true })).toBeEnabled();
    expect(await replacement.evaluate(() => ((window as unknown as { captureTracks?: MediaStreamTrack[] }).captureTracks ?? []).length)).toBe(0);
    await replacement.getByRole('button', { name: 'Share your MATLAB tab', exact: true }).click();
    await expect(replacement.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    await expect(shadow(lab.target, '.now')).toHaveText(await replacement.getByTestId('execution-now').innerText());
    await replacement.getByRole('button', { name: 'Stop sharing', exact: true }).click();
  } finally { await lab.close(); }
});

test('lost creation response recovers one saved lab after reload and still requires explicit Share', async ({ request }) => {
  const lab = await isolatedLab();
  try {
    await request.post('http://127.0.0.1:8002/__test/mode/lose_create_response');
    const lost = lab.reader.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/execution'));
    await lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true }).click();
    expect((await lost).status()).toBe(503);
    await expect(lab.reader.getByRole('region', { name: 'Lab connection', exact: true }).getByRole('status')).toContainText('Lab tracking is unavailable');
    await lab.reader.reload();
    const recover = lab.reader.getByRole('button', { name: 'Recover saved lab', exact: true });
    await expect(recover).toBeVisible();
    const noCapture = () => lab.reader.evaluate(() => ((window as unknown as { captureTracks?: MediaStreamTrack[] }).captureTracks ?? []).length);
    expect(await noCapture()).toBe(0);
    const replay = lab.reader.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/execution'));
    await recover.click(); expect((await replay).postDataJSON()).toEqual({ recoverPending: true });
    await expect(lab.reader.getByRole('region', { name: 'Lab connection', exact: true }).getByRole('status').first()).toContainText('Your saved lab is ready');
    expect(await noCapture()).toBe(0);
    const ids = (await (await request.get('http://127.0.0.1:8002/__test/status')).json()).creation_ids;
    expect(ids).toHaveLength(2); expect(new Set(ids).size).toBe(1);
    await lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true }).click();
    await expect(lab.reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    await lab.reader.getByRole('button', { name: 'Stop sharing', exact: true }).click();
  } finally { await lab.close(); }
});

test('all twelve checkpoints accept explicit synthetic responses and reviewed criteria through the capture controller', async ({ request }) => {
  test.setTimeout(180000);
  const lab = await isolatedLab();
  try {
    await lab.reader.getByRole('button', { name: 'Share your MATLAB tab', exact: true }).click();
    await expect(lab.reader.getByRole('button', { name: 'Pause sharing', exact: true })).toBeVisible();
    const connection = lab.reader.getByRole('region', { name: 'Lab connection', exact: true });
    const selectCurrent = async () => {
      const use = lab.reader.getByRole('button', { name: 'Use current step', exact: true });
      if (await use.isVisible()) await use.click();
    };
    for (let n = 1; n <= 12; n++) {
      const cp = `CP-DSB-${String(n).padStart(2, '0')}`;
      await expect(connection.getByText(`NOW · ${cp}`, { exact: true })).toBeVisible();
      await selectCurrent();
      if (n >= 11) {
        await lab.reader.getByRole('button', { name: `Declare intended ${n === 11 ? 'phase fault' : 'restored baseline'}`, exact: true }).click();
        await expect(connection.getByRole('status').filter({ hasText: 'Intended condition recorded' })).toBeVisible();
        await selectCurrent();
      }
      await expect(lab.reader.getByLabel('Response kind')).toBeVisible();
      for (const kind of n === 11 ? ['prediction', 'observation'] : [n === 12 ? 'explanation' : 'observation']) {
        await lab.reader.getByLabel('Response kind').selectOption(kind);
        await lab.reader.getByLabel('Your own words', { exact: true }).fill(`Explicit synthetic ${kind} for ${cp}; no assessed student work.`);
        await lab.reader.getByRole('button', { name: 'Record response', exact: true }).click();
        await expect(connection.getByRole('status').filter({ hasText: 'Your response was recorded' })).toBeVisible();
      }
      const boxes = connection.getByRole('checkbox');
      expect(await boxes.count()).toBeGreaterThan(0);
      for (const box of await boxes.all()) { await expect(box).not.toBeChecked(); await box.check(); }
      await lab.reader.getByLabel('What evidence did you review?', { exact: true }).fill(`I explicitly reviewed the synthetic fixture for ${cp}.`);
      const confirm = lab.reader.getByRole('button', { name: 'Confirm selected criteria', exact: true });
      await expect(confirm).toBeEnabled({ timeout: 25000 });
      const response = lab.reader.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/execution/review'));
      await confirm.click();
      const saved = await response; expect(saved.status()).toBe(200);
      const state = (await saved.json()).state;
      expect(state.queue.done_checkpoint_ids).toHaveLength(n);
      const steps = Array.isArray(state.steps) ? state.steps : Object.values(state.steps);
      const done = steps.find((s: { checkpoint_id: string }) => s.checkpoint_id === cp);
      expect(done.assessment_status).toBe('unassessed');
      expect(done.criteria.every((c: { completion_basis: string }) => c.completion_basis === 'student_confirmation_unassessed')).toBe(true);
    }
    await expect(connection).toContainText('This guide does not issue an assessment result.');
    await expect(lab.reader.getByRole('button', { name: 'Pause sharing', exact: true })).toHaveCount(0);
    await lab.reader.reload();
    await expect(connection).toContainText('This guide does not issue an assessment result.');
    expect(await lab.reader.evaluate(() => ((window as unknown as { captureTracks?: MediaStreamTrack[] }).captureTracks ?? []).length)).toBe(0);
    const paths: string[] = (await (await request.get('http://127.0.0.1:8002/__test/status')).json()).recordPaths;
    expect(paths.some(p => /attempts|evidence|mastery/.test(p))).toBe(false);
  } finally { await lab.close(); }
});
async function bootstrap(page: Page, reopen?: string) {
  await page.addInitScript(() => {
    const g = window as unknown as { captureDiagnostics: object; rectDiagnostics: object; videoDiagnostics: object; playError: object; captureTracks: MediaStreamTrack[]; snapshotDiagnostics?: { sentRevision: number; displayedRevision: number; generation: number }; helloDiagnostics?: { stream_id: string; generation: number; count: number } };
    const capture = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async options => { const stream = await capture(options); g.captureDiagnostics = stream.getVideoTracks()[0].getSettings(); (g.captureTracks ??= []).push(...stream.getTracks()); return stream; };
    const revisions = new Map<number, { revision: number; generation: number }>();
    window.addEventListener('message', e => {
      if (e.source !== window || e.origin !== location.origin || e.data?.channel !== 'kiki-floating-guidance') return;
      const m = e.data;
      if (m.type === 'fg_rects') g.rectDiagnostics = { viewport: m.viewport, moving: m.moving };
      if (m.direction === 'page' && m.type === 'reader_snapshot') revisions.set(m.bridge_id, { revision: m.message.body.lab_revision, generation: m.message.generation });
      if (m.direction === 'extension' && m.type === 'response') {
        if (m.result?.ok && Number.isSafeInteger(m.result.generation)) g.helloDiagnostics = { stream_id: m.stream_id, generation: m.result.generation, count: (g.helloDiagnostics?.count ?? 0) + 1 };
        const sent = revisions.get(m.bridge_id); revisions.delete(m.bridge_id);
        if (sent && m.result?.ok && m.result.result?.lab_revision !== undefined) g.snapshotDiagnostics = { sentRevision: sent.revision, displayedRevision: m.result.result.lab_revision, generation: sent.generation };
      }
    });
    const play = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = async function () { try { await play.call(this); } catch (error) { g.playError = { name: (error as Error).name, message: (error as Error).message }; throw error; } setInterval(() => { g.videoDiagnostics = { width: this.videoWidth, height: this.videoHeight, ready: this.readyState }; }, 500); };
  });
  await page.route(`${root}/**`, async route => {
    if (route.request().isNavigationRequest()) {
      const response = await route.fetch({ url: `${root}/tests/lab-screen-share/index.html` });
      await route.fulfill({ response, body: (await response.text()).replace('src="./main.tsx"', 'src="/tests/lab-screen-share/main.tsx"') });
    } else await route.continue();
  });
  await page.goto(reopen ?? `${root}/tests/lab-screen-share/index.html`);
  if (reopen) return;
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
    await expect.poll(() => reader.evaluate(() => {
      const d = (window as unknown as { snapshotDiagnostics?: { sentRevision: number; displayedRevision: number } }).snapshotDiagnostics;
      return Boolean(d && d.sentRevision > 0 && d.sentRevision === d.displayedRevision);
    })).toBe(true);
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
