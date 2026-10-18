// Local test artifact only. Release extension remains owned by kiki-backend.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
// Use an already hash-verified canonical dev bundle without rewriting its version,
// config or scripts. This option never modifies the backend's running checkout.
if (process.env.KIKI_EXTENSION_SOURCE) {
  const source = resolve(process.env.KIKI_EXTENSION_SOURCE), out = resolve('test-artifacts/lab-extension');
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  if (manifest.version !== '0.1.1' || !manifest.name.endsWith('(dev)')) throw new Error('Expected canonical dev extension 0.1.1');
  await mkdir(out, { recursive: true });
  for (const name of ['manifest.json', 'config.js', 'core.js', 'ui.js', 'content.js', 'bridge.js', 'background.js', 'popup.html', 'popup.js']) await copyFile(join(source, name), join(out, name));
  console.log(`Copied verified canonical dev extension ${manifest.version}: ${out}`);
} else {
if (!process.env.KIKI_BACKEND_CHECKOUT) throw new Error('Set KIKI_BACKEND_CHECKOUT to the approved backend checkout');
const source = resolve(process.env.KIKI_BACKEND_CHECKOUT, 'prototypes/floating_guidance/extension');
const out = resolve('test-artifacts/lab-extension');
await mkdir(out, { recursive: true });
for (const name of ['core.js','ui.js','content.js','bridge.js','background.js','popup.html','popup.js']) await copyFile(join(source,name),join(out,name));
const config = { version:'0.1.0', dev:true, readers:['http://127.0.0.1:5174'], targets:['https://matlab.mathworks.com','http://localhost:8871'] };
await writeFile(join(out,'config.js'), `globalThis.KIKI_FG_CONFIG=${JSON.stringify(config)};\n`);
const manifest = {manifest_version:3,name:'Kiki windows (isolated local test)',version:'0.1.0',minimum_chrome_version:'116',permissions:['storage','scripting'],host_permissions:config.targets.map(o=>o+'/*'),background:{service_worker:'background.js'},action:{default_popup:'popup.html'},content_scripts:[{matches:config.targets.map(o=>o+'/*'),js:['config.js','core.js','ui.js','content.js'],run_at:'document_start'},{matches:config.readers.map(o=>o+'/*'),js:['config.js','bridge.js'],run_at:'document_start'}]};
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
// Verify source protocol files were actually read; no network or release writes.
await readFile(join(source,'core.js'),'utf8');
console.log(`Built local test extension: ${out}`);
}
