import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { canPrepareExtension, prepareExtensionFolder } from './prepare-extension';
const release = new Uint8Array(readFileSync(new URL('../../../public/lab-extension/kiki-lab-extension.zip', import.meta.url)));
function setup(initial: Record<string, Uint8Array> = {}) {
  const files = new Map(Object.entries(initial));
  let failFile = '';
  const folder = {
    async *entries() { for (const entry of files.entries()) yield entry; },
    removeEntry: vi.fn(async (name: string) => { files.delete(name); }),
    getFileHandle: vi.fn(async (name: string) => ({
      getFile: async () => ({ text: async () => strFromU8(files.get(name)!) }),
      createWritable: async () => ({ write: async (data: Uint8Array) => { if (name === failFile) throw new Error('Disk full'); files.set(name, data); }, close: async () => {} }),
    })),
  };
  const picker = vi.fn(async () => folder);
  vi.stubGlobal('window', { showDirectoryPicker: picker });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => release.buffer })));
  return { files, picker, folder, fail: (name: string) => { failFile = name; } };
}
afterEach(() => vi.unstubAllGlobals());
it('extracts the actual release into the chosen folder and writes manifest last', async () => {
  const { files, folder, picker } = setup();
  expect(canPrepareExtension()).toBe(true); await prepareExtensionFolder();
  expect(picker).toHaveBeenCalledWith({ mode: 'readwrite', id: 'kiki-lab-extension' });
  expect([...files.keys()].sort()).toEqual(Object.keys(unzipSync(release)).sort());
  expect(folder.getFileHandle.mock.calls.at(-1)?.[0]).toBe('manifest.json');
  expect(JSON.parse(strFromU8(files.get('manifest.json')!)).version).toBe('0.1.6');
});
it('updates in the same selected Kiki folder and leaves Finder metadata alone', async () => {
  const { files, picker } = setup({ ...unzipSync(release), '.DS_Store': strToU8('finder') });
  await prepareExtensionFolder(); expect(picker).toHaveBeenCalledTimes(1);
  expect(strFromU8(files.get('.DS_Store')!)).toBe('finder'); expect(files.has('.kiki-extension-setup.json')).toBe(false);
});
it('rejects unrelated folders or another extension before writing', async () => {
  const folders: Record<string, Uint8Array>[] = [
    { 'personal.txt': strToU8('private') },
    { 'manifest.json': strToU8('{"name":"Other extension","manifest_version":3}') },
  ];
  for (const content of folders) {
    const { folder } = setup(content); await expect(prepareExtensionFolder()).rejects.toThrow(/folder|another extension/);
    expect(folder.getFileHandle.mock.calls.some(call => call.length > 1)).toBe(false); expect(fetch).not.toHaveBeenCalled();
  }
});
it('does not download or write if the user cancels the folder picker', async () => {
  const { picker, folder } = setup(); picker.mockRejectedValue(new Error('Cancelled'));
  await expect(prepareExtensionFolder()).rejects.toThrow('Cancelled');
  expect(fetch).not.toHaveBeenCalled(); expect(folder.getFileHandle).not.toHaveBeenCalled();
});
it('supports retrying the same partially written folder after a disk failure', async () => {
  const { fail, files } = setup(); fail('core.js');
  await expect(prepareExtensionFolder()).rejects.toThrow('Disk full');
  expect(files.has('.kiki-extension-setup.json')).toBe(true);
  fail(''); await prepareExtensionFolder();
  expect(files.has('manifest.json')).toBe(true); expect(files.has('.kiki-extension-setup.json')).toBe(false);
});
it('rejects incomplete or unexpected ZIP entries before writing', async () => {
  const { folder } = setup();
  vi.mocked(fetch).mockResolvedValue({ ok: true, arrayBuffer: async () => zipSync({ 'unexpected.js': strToU8('bad') }).buffer } as Response);
  await expect(prepareExtensionFolder()).rejects.toThrow('incomplete'); expect(folder.getFileHandle).not.toHaveBeenCalled();
});

it('ships the approved logo at Chrome toolbar and management sizes', () => {
  const files = unzipSync(release);
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  for (const size of [16, 32, 48, 128]) {
    const name = manifest.icons[String(size)];
    expect(manifest.action.default_icon[String(size)]).toBe(name);
    const png = files[name];
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(header.getUint32(16)).toBe(size); expect(header.getUint32(20)).toBe(size);
  }
});

it('adds icons when updating an existing iconless Kiki folder', async () => {
  const previous = unzipSync(release);
  for (const name of Object.keys(previous)) if (name.startsWith('icon-')) delete previous[name];
  const manifest = JSON.parse(strFromU8(previous['manifest.json']));
  delete manifest.icons; delete manifest.action.default_icon;
  previous['manifest.json'] = strToU8(JSON.stringify(manifest));
  const { files, picker } = setup(previous);
  await prepareExtensionFolder();
  expect(picker).toHaveBeenCalledTimes(1);
  expect(files.has('icon-128.png')).toBe(true);
  expect(JSON.parse(strFromU8(files.get('manifest.json')!)).icons['16']).toBe('icon-16.png');
});
