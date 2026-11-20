import { defineConfig } from '@playwright/test';

const python = process.platform === 'win32' ? '..\\api\\.venv\\Scripts\\python.exe' : '../api/.venv/bin/python';
const backend = process.env.KIKI_BACKEND_CHECKOUT;
if (!backend || !process.env.KIKI_PHYSICAL_TEST_NARRATION_DIR) {
  throw new Error('Set KIKI_BACKEND_CHECKOUT and KIKI_PHYSICAL_TEST_NARRATION_DIR.');
}

export default defineConfig({
  testDir: './tests/physical-lab', workers: 1, timeout: 60000,
  outputDir: './test-artifacts/physical-lab',
  use: { baseURL: 'http://127.0.0.1:5202', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev -- --port 5202 --strictPort', url: 'http://127.0.0.1:5202' },
    {
      command: `${python} ../api/tests/physical_lab_preview_server.py --backend-root "${backend}"`,
      url: 'http://127.0.0.1:8092/health', timeout: 30000,
    },
  ],
});
