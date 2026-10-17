import { defineConfig } from 'vitest/config';
// The sample media adapter reads the committed package in data-model/media, outside this app.
export default defineConfig({ server: { fs: { allow: ['.', '../../data-model/media'] } }, test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'node' } });
