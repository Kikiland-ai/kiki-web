import { loadEnv } from 'vite';
import { connectionConfig } from '../src/services/connection-config.ts';
try {
  const settings = { ...loadEnv('development', process.cwd(), 'VITE_'), ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('VITE_'))) };
  const config = connectionConfig(settings, true);
  if (settings.VITE_APP_MODE !== 'connected') throw new Error('Set VITE_APP_MODE=connected in .env.development.local.');
  console.log(`Connected settings valid (${config.emulatorUrl ? 'local Auth emulator' : 'real Firebase Auth'}).`);
  console.log('This checks configuration only; Google provider, authorized domains and Python availability need integration checks.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Connection configuration is invalid.');
  process.exitCode = 1;
}
