import { unzipSync, strFromU8 } from 'fflate';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function xml(bytes: Uint8Array | undefined) {
  if (!bytes) throw new Error('This PPTX is missing a required presentation part.');
  const text = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Unsupported XML in presentation.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The presentation XML could not be read.');
  return doc;
}
export function extractPptx(data: Uint8Array) {
  let expanded = 0, count = 0;
  const files = unzipSync(data, { filter: file => {
    const include = ['ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels'].includes(file.name) || /^ppt\/slides\/slide\d+\.xml$/.test(file.name);
    if (include) {
      if (++count > 502) throw new Error('Choose a presentation with up to 500 slides.');
      expanded += file.originalSize;
      if (file.originalSize > 2 * 1024 * 1024 || expanded > 16 * 1024 * 1024) throw new Error('This presentation is too complex. Export a smaller PPTX or PDF.');
    }
    return include;
  } });
  const presentation = xml(files['ppt/presentation.xml']);
  const relations = xml(files['ppt/_rels/presentation.xml.rels']);
  const targets = new Map([...relations.getElementsByTagName('Relationship')].filter(e => e.getAttribute('TargetMode') !== 'External').map(e => [e.getAttribute('Id'), e.getAttribute('Target')]));
  const ids = [...presentation.getElementsByTagNameNS(P, 'sldId')];
  if (!ids.length || ids.length > 500) throw new Error('Choose a PPTX with 1–500 slides.');
  let length = 0;
  const units = ids.map((slide, i) => {
    const target = targets.get(slide.getAttributeNS(R, 'id'));
    if (!target || !/^(?:slides\/|\/ppt\/slides\/)slide\d+\.xml$/.test(target)) throw new Error('Unsupported slide relationship. Export this file as a standard PPTX.');
    const path = target.startsWith('/') ? target.slice(1) : `ppt/${target}`;
    const doc = xml(files[path]);
    const text = [...doc.getElementsByTagNameNS(A, 'p')].map(p => [...p.querySelectorAll('*')].map(t => t.namespaceURI !== A ? '' : t.localName === 't' ? t.textContent ?? '' : t.localName === 'br' ? '\n' : t.localName === 'tab' ? '\t' : '').join('')).join('\n');
    length += new TextEncoder().encode(text).length;
    if (length > 1024 * 1024) throw new Error('Keep extracted text below 1 MiB per document. Split this presentation.');
    return { number: i + 1, text };
  });
  return { method: 'pptx-text' as const, unitLabel: 'slide' as const, unitCount: ids.length, units };
}
