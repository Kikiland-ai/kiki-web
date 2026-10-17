// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createFixtureIntake } from './intake';
import { readBlob } from './material-store';
import { documentText } from '../contracts/document-text';
import { pastedDocument } from '../features/intake/text/extract';
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
describe('sample text Library mirrors saved text without binaries', () => {
  it('saves, lists, reopens and repeats the same save without an original blob', async () => {
    const input = { courseId: 'CRS-AC-ECE', kind: 'notes' as const, topic: 'Analog Modulation', note: '', classDate: '', documents: [pastedDocument('My notes', 'DSB-SC\nଓଡ଼ିଆ')] };
    const api = createFixtureIntake(() => 'text-owner');
    const request = await api.createText!(input, 'unit-text-save');
    expect(request.status).toBe('text_saved');
    expect(request.sources[0].originalAvailable).toBe(false);
    expect(await api.list()).toEqual([request]);
    expect((await api.text!(request.sources[0].id)).chunks.map(c => c.text).join('')).toBe(documentText(input.documents[0]));
    await expect(readBlob(request.sources[0].id)).rejects.toThrow();
    expect(await api.createText!(input, 'unit-text-save')).toEqual(request);
    await expect(api.createText!({ ...input, note: 'Changed' }, 'unit-text-save')).rejects.toThrow('different');
    await expect(createFixtureIntake(() => 'another-owner').text!(request.sources[0].id)).rejects.toThrow('not be found');
  });
});
