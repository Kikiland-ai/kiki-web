import { defineConfig } from '@playwright/test';
// Playwright runs webServer commands through cmd.exe on Windows, which needs backslashes.
const python = process.platform === 'win32' ? '..\\api\\.venv\\Scripts\\python.exe' : '../api/.venv/bin/python';
export default defineConfig({
  testDir: './tests/lab-screen-share', workers: 1, timeout: 120000,
  outputDir: './test-artifacts/lab-browser-results',
  use: { baseURL: 'http://127.0.0.1:5174', actionTimeout: 15000 },
  webServer: [
    { command: 'npm run dev -- --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false },
    { command: `${python} ../api/tests/lab_screen_share_server.py`, url: 'http://127.0.0.1:8002/health', timeout: 30000, reuseExistingServer: false },
  ],
});
