import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && (env.VITE_APP_MODE === 'fixture' || process.env.VITE_APP_MODE === 'fixture')) {
    throw new Error('Fixture mode is development-only. Build with connected configuration.');
  }
  return { plugins: [react()], server: { strictPort: true, port: 5173 }, preview: { port: 4173 } };
});
