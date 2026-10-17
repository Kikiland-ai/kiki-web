import { defineConfig } from '@playwright/test';
const port = Number(process.env.KIKI_E2E_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid KIKI_E2E_PORT');
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests', fullyParallel: true,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: { command: `npm run dev -- --port ${port}`, url: baseURL, reuseExistingServer: !process.env.CI },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
