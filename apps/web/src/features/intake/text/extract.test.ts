// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { documentText, splitDocumentText } from '../../../contracts/document-text';
import { extractDocument, pastedDocument } from './extract';
import { extractPptx } from './pptx';
function presentation(text = '<a:r><a:t>car</a:t></a:r><a:r><a:t>rier ଓଡ଼ିଆ</a:t></a:r>') {
  const ns = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
  return zipSync({
    'ppt/presentation.xml': strToU8(`<p:presentation ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="second"/><p:sldId r:id="first"/></p:sldIdLst></p:presentation>`),
    'ppt/_rels/presentation.xml.rels': strToU8('<Relationships><Relationship Id="first" Target="slides/slide1.xml"/><Relationship Id="second" Target="slides/slide2.xml"/></Relationships>'),
    'ppt/slides/slide1.xml': strToU8(`<p:sld ${ns}><a:p><a:r><a:t>First XML file</a:t></a:r></a:p></p:sld>`),
    'ppt/slides/slide2.xml': strToU8(`<p:sld ${ns}><a:p>${text}</a:p></p:sld>`),
    'ppt/media/image.png': new Uint8Array([0,1,2]),
  });
}
function file(data: Uint8Array, name = 'notes.pptx') {
  const bytes = new Uint8Array(data).buffer;
  return Object.assign(new File([bytes], name), { arrayBuffer: async () => bytes });
}
describe('actual PPTX text extraction', () => {
  it('uses presentation order, joins styled runs and preserves Odia', async () => {
    const result = await extractDocument(file(presentation()));
    expect(result.units).toEqual([{ number: 1, text: 'carrier ଓଡ଼ିଆ' }, { number: 2, text: 'First XML file' }]);
    expect(result.method).toBe('pptx-text');
    expect(result.warnings[0]).toContain('Images');
  });
  it('preserves explicit line breaks between styled runs', () => {
    const result = extractPptx(presentation('<a:r><a:t>first</a:t></a:r><a:br/><a:r><a:t>second</a:t></a:r>'));
    expect(result.units[0].text).toBe('first\nsecond');
  });
  it('rejects unsafe/external slide relationships', () => {
    const bytes = zipSync({ 'ppt/presentation.xml': strToU8('<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldId r:id="x"/></p:presentation>'), 'ppt/_rels/presentation.xml.rels': strToU8('<Relationships><Relationship Id="x" Target="../../secret"/></Relationships>') });
    expect(() => extractPptx(bytes)).toThrow('Unsupported slide relationship');
  });
  it('warns about slides without text instead of inventing content', async () => {
    const result = await extractDocument(file(presentation('')));
    expect(result.units).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('no extractable text');
  });
  it('explains the older PPT and empty/oversized file limits', async () => {
    await expect(extractDocument(file(new Uint8Array([1]), 'old.ppt'))).rejects.toThrow('Convert older .ppt');
    await expect(extractDocument(file(new Uint8Array()))).rejects.toThrow('non-empty');
    await expect(extractDocument({ size: 11 * 1024 * 1024, name: 'big.pdf' } as File)).rejects.toThrow('10 MB');
  });
  it('does not continue after cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(extractDocument(file(presentation()), controller.signal)).rejects.toThrow();
  });
});
describe('reviewed plain text', () => {
  it('retains Unicode and source labels without creating an original-file claim', () => {
    const doc = pastedDocument('My notes', '  English\nଓଡ଼ିଆ\u0000  ');
    expect(doc.method).toBe('pasted');
    expect(documentText(doc)).toBe('Section 1\nEnglish\nଓଡ଼ିଆ');
    expect(doc.warnings[0]).toContain('not verified');
  });
  it('chunks without truncating UTF-8 and bounds text by bytes', () => {
    const text = 'ଓଡ଼ିଆ 🌱 English\n'.repeat(5000), chunks = splitDocumentText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
    expect(chunks.every(c => new TextEncoder().encode(c).length <= 32768)).toBe(true);
    expect(() => pastedDocument('Too big', 'ଓ'.repeat(400000))).toThrow();
    expect(() => pastedDocument('Blank', ' ')).toThrow();
  });
});
