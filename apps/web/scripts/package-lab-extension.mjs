// Build only the canonical backend release; never ship dev permissions to learners.
// npm run package:lab-extension -- /absolute/path/to/kiki-backend
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { zipSync } from 'fflate';
const backend = process.argv[2];
if (!backend) throw new Error('Pass the canonical kiki-backend checkout path.');
execFileSync(process.execPath, [resolve(backend, 'prototypes/floating_guidance/scripts/build-extension.mjs')], { cwd: resolve(backend), stdio: 'inherit' });
const source = resolve(backend, 'work/floating-guidance/release');
const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
const [major = 0, minor = 0, patch = 0] = manifest.version.split('.').map(Number);
if (major === 0 && (minor < 1 || (minor === 1 && patch < 4))) throw new Error('Apply docs/patches/lab-extension-status-backend.patch to the compatible backend before packaging its status-capable release.');
if (manifest.name !== 'Kiki windows' || manifest.content_scripts.some(s => s.matches.some(m => m.startsWith('http:')))) throw new Error('Expected release permissions.');
const files = {};
for (const name of await readdir(source)) files[name] = new Uint8Array(await readFile(join(source, name)));
const output = new URL('../public/lab-extension/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('kiki-lab-extension.zip', output), zipSync(files));
await writeFile(new URL('latest.json', output), JSON.stringify({ version: manifest.version }) + '\n');
console.log(`Packaged Lab extension ${manifest.version}`);
