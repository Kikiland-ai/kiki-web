import { unzipSync, strFromU8 } from 'fflate';

type Writable = { write(data: Uint8Array): Promise<void>; close(): Promise<void> };
type Directory = {
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterableIterator<[string, unknown]>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ getFile(): Promise<{ text(): Promise<string> }>; createWritable(): Promise<Writable> }>;
};
type FolderWindow = Window & { showDirectoryPicker?: (options: { mode: 'readwrite'; id: string }) => Promise<Directory> };
const markerName = '.kiki-extension-setup.json';
const markerContent = new TextEncoder().encode(JSON.stringify({ source: 'Kiki windows', schema: 1 }));
const expectedFiles = ['manifest.json', 'config.js', 'core.js', 'ui.js', 'content.js', 'bridge.js', 'background.js', 'popup.html', 'popup.js'];
export function canPrepareExtension() { return typeof (window as FolderWindow).showDirectoryPicker === 'function'; }
export async function prepareExtensionFolder(): Promise<void> {
  const picker = (window as FolderWindow).showDirectoryPicker;
  if (!picker) throw new Error('Folder setup is unavailable here. Use the ZIP download instead.');
  // Ask on the click, before any async fetch, to preserve Chrome's user gesture.
  const folder = await picker.call(window, { mode: 'readwrite', id: 'kiki-lab-extension' });
  const names: string[] = [];
  for await (const [name] of folder.entries()) names.push(name);
  const contentNames = names.filter(name => name !== '.DS_Store' && name !== markerName);
  if (contentNames.length || names.includes(markerName)) {
    if (contentNames.some(name => !expectedFiles.includes(name))) throw new Error('Choose an empty folder or your existing Kiki extension folder.');
    const identityName = contentNames.includes('manifest.json') ? 'manifest.json' : names.includes(markerName) ? markerName : null;
    if (!identityName) throw new Error('Choose an empty folder or your existing Kiki extension folder.');
    const existing = JSON.parse(await (await (await folder.getFileHandle(identityName)).getFile()).text());
    const recognized = identityName === markerName ? existing.source === 'Kiki windows' && existing.schema === 1 : existing.name === 'Kiki windows' && existing.manifest_version === 3;
    if (!recognized) throw new Error('This folder belongs to another extension. Choose an empty folder or the existing Kiki extension folder.');
  }
  const response = await fetch('/lab-extension/kiki-lab-extension.zip', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('The extension download failed. Try again.');
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  if (Object.keys(files).length !== expectedFiles.length || expectedFiles.some(name => !files[name])) throw new Error('The extension package is incomplete. Try again later.');
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  if (manifest.name !== 'Kiki windows' || manifest.manifest_version !== 3 || manifest.content_scripts.some((script: { matches: string[] }) => script.matches.some(match => match.startsWith('http:')))) throw new Error('This package is not the Kiki release extension.');
  const marker = await (await folder.getFileHandle(markerName, { create: true })).createWritable();
  await marker.write(markerContent); await marker.close();
  // Validate all files before writing. Manifest last; retry this same folder
  // after a write failure. Chrome still owns permission to load/reload it.
  for (const name of [...expectedFiles.filter(name => name !== 'manifest.json'), 'manifest.json']) {
    const file = await folder.getFileHandle(name, { create: true });
    const writer = await file.createWritable();
    await writer.write(files[name]); await writer.close();
  }
  await folder.removeEntry(markerName);
}
