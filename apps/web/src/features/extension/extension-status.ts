/** Status-only protocol: never use reader_hello here (it claims lab control). */
export const CHANNEL = 'kiki-floating-guidance';
export const CHECK_INTERVAL = 5 * 60_000;
export type ExtensionState = { kind: 'checking' | 'current' | 'missing' | 'outdated' | 'unknown'; installed: string | null; latest: string | null };
export const validVersion = (value: unknown): value is string => typeof value === 'string' && /^\d{1,5}(\.\d{1,5}){0,3}$/.test(value) && value.split('.').every(n => Number(n) <= 65535);
export function compareVersions(a: string, b: string) {
  const aa = a.split('.').map(Number), bb = b.split('.').map(Number);
  for (let i = 0; i < 4; i++) { const difference = (aa[i] ?? 0) - (bb[i] ?? 0); if (difference) return difference; }
  return 0;
}
// Legacy builds announce only during page load, often before Google sign-in resolves.
// Remember the public version for this document only; do not persist it to storage.
let legacyAnnouncement: { version: string; at: number } | null = null;
export function observeLegacyAnnouncements() {
  const receive = (event: MessageEvent) => {
    const m = event.data;
    if (event.source === window && event.origin === location.origin && m?.channel === CHANNEL && m.direction === 'extension' && m.type === 'extension_present' && validVersion(m.version) && compareVersions(m.version, '0.1.4') < 0) legacyAnnouncement = { version: m.version, at: Date.now() };
  };
  window.addEventListener('message', receive);
  return () => { window.removeEventListener('message', receive); legacyAnnouncement = null; };
}
export function watchExtension(report: (state: ExtensionState) => void) {
  let installed: string | null = legacyAnnouncement && Date.now() - legacyAnnouncement.at < CHECK_INTERVAL ? legacyAnnouncement.version : null, latest: string | null = null;
  let disposed = false, busy = false, legacy = Boolean(installed), requestId = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: AbortController | undefined;
  const emit = (kind?: ExtensionState['kind']) => {
    if (!disposed) report({ installed, latest, kind: kind ?? (!installed ? 'missing' : !latest ? 'unknown' : compareVersions(installed, latest) >= 0 ? 'current' : 'outdated') });
  };
  const receive = (event: MessageEvent) => {
    const m = event.data;
    if (disposed || event.source !== window || event.origin !== location.origin || m?.channel !== CHANNEL || m.direction !== 'extension' || !validVersion(m.version)) return;
    if (m.type === 'extension_status' && m.request_id === requestId) {
      clearTimeout(timer); installed = m.version; legacy = false; emit();
    } else if (m.type === 'extension_present') {
      installed = m.version; legacy = compareVersions(m.version, '0.1.4') < 0; emit();
    }
  };
  async function check() {
    if (disposed || busy || document.visibilityState === 'hidden') return;
    busy = true;
    requestId = crypto.randomUUID();
    clearTimeout(timer);
    // Keep known legacy installs yellow; they cannot answer recurring probes.
    timer = setTimeout(() => { if (!legacy) installed = null; emit(legacy ? 'outdated' : undefined); }, 2500);
    window.postMessage({ channel: CHANNEL, direction: 'page', type: 'reader_status', request_id: requestId }, location.origin);
    abort = new AbortController();
    const deadline = setTimeout(() => abort?.abort(), 5000);
    try {
      const response = await fetch('/lab-extension/latest.json', { cache: 'no-store', signal: abort.signal });
      if (!response.ok) throw new Error('Release unavailable');
      const release: unknown = await response.json();
      if (!release || typeof release !== 'object' || !('version' in release) || !validVersion(release.version)) throw new Error('Invalid release');
      latest = release.version;
    } catch { latest = null; }
    finally { clearTimeout(deadline); busy = false; }
    if (!disposed && installed) emit();
  }
  const visible = () => { void check(); };
  window.addEventListener('message', receive);
  window.addEventListener('focus', visible);
  window.addEventListener('online', visible);
  document.addEventListener('visibilitychange', visible);
  emit('checking'); void check();
  const interval = setInterval(visible, CHECK_INTERVAL);
  return { check, dispose() {
    disposed = true; abort?.abort(); clearTimeout(timer); clearInterval(interval);
    window.removeEventListener('message', receive); window.removeEventListener('focus', visible); window.removeEventListener('online', visible); document.removeEventListener('visibilitychange', visible);
  } };
}
