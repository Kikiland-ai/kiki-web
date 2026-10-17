export class ConnectionConfigError extends Error {}
function parseUrl(value: string, label: string) {
  try { return new URL(value); }
  catch { throw new ConnectionConfigError(`${label} must be an absolute URL.`); }
}
export interface ConnectionConfig {
  firebase: { apiKey: string; authDomain: string; projectId: string; appId: string };
  apiBaseUrl: string;
  emulatorUrl?: string;
}
export function connectionConfig(env: Record<string, string | undefined>, development: boolean): ConnectionConfig {
  const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_API_BASE_URL'] as const;
  const missing = required.filter(key => !env[key]?.trim() || /^(\*+|YOUR_.*|REPLACE_.*)$/i.test(env[key]!.trim()));
  if (missing.length) throw new ConnectionConfigError(`Missing connected settings: ${missing.join(', ')}. See FIREBASE_SETUP.md.`);
  const firebase = { apiKey: env.VITE_FIREBASE_API_KEY!.trim(), authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!.trim(), projectId: env.VITE_FIREBASE_PROJECT_ID!.trim(), appId: env.VITE_FIREBASE_APP_ID!.trim() };
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(firebase.authDomain)) throw new ConnectionConfigError('Firebase authDomain must be a hostname, without https:// or a path.');
  const api = parseUrl(env.VITE_API_BASE_URL!.trim(), 'The Python API address');
  if (api.username || api.password || api.search || api.hash || !['http:', 'https:'].includes(api.protocol) || (!development && api.protocol !== 'https:')) throw new ConnectionConfigError('The Python API must use HTTPS in production and cannot contain credentials, a query or a fragment.');
  const emulatorUrl = env.VITE_AUTH_EMULATOR_URL?.trim() || undefined;
  if (emulatorUrl) {
    const emulator = parseUrl(emulatorUrl, 'The Auth emulator address');
    if (!development || firebase.projectId !== 'demo-kiki-local' || !['localhost','127.0.0.1'].includes(emulator.hostname) || emulator.protocol !== 'http:' || emulator.username || emulator.password || emulator.search || emulator.hash || emulator.pathname !== '/') throw new ConnectionConfigError('Local auth requires demo-kiki-local and an HTTP localhost emulator.');
  } else if (firebase.projectId.startsWith('demo-')) throw new ConnectionConfigError('A demo Firebase project requires the local Auth emulator.');
  return { firebase, apiBaseUrl: api.toString().replace(/\/$/, ''), emulatorUrl };
}
