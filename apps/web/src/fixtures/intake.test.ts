import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createFixtureIntake } from './intake';
import { COURSE } from '../contracts/profile';
import { validateMaterial, type CreateIntake } from '../contracts/intake';

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });
const pdf = () => new File(['%PDF-1.4\nPreview test material'], 'notes.pdf', { type: 'application/pdf' });
const input = (): CreateIntake => ({ courseId: COURSE.id, kind: 'notes', topic: COURSE.chapter, note: 'This was taught today', classDate: '', files: [pdf()] });
describe('material preview preserves originals and explicit states', () => {
  it('persists exact bytes and resumes without inventing analysis', async () => {
    const api = createFixtureIntake(() => 'student-a');
    const saved = await api.create(input(), 'operation-123');
    expect(saved.status).toBe('reading'); expect(saved.outline).toBeNull();
    const reopened = createFixtureIntake(() => 'student-a');
    expect((await reopened.get(saved.id)).status).toBe('reading');
    const original = await reopened.source(saved.sources[0].id);
    expect(await original.blob.text()).toBe(await pdf().text());
    expect(original.source.title).toBe('notes.pdf');
  });
  it('reuses an upload operation rather than creating duplicate sources; rejects changed input', async () => {
    const api = createFixtureIntake(() => 'student-a');
    const first = await api.create(input(), 'operation-123');
    expect((await api.create(input(), 'operation-123')).id).toBe(first.id);
    expect(await api.list()).toHaveLength(1);
    await expect(api.create({ ...input(), topic: 'A different topic' }, 'operation-123')).rejects.toThrow('different files or details');
  });
  it('isolates another learner and blocks changes after auth loss', async () => {
    let uid: string | null = 'student-a';
    const api = createFixtureIntake(() => { if (!uid) throw new Error('Sign-in required'); return uid; });
    const saved = await api.create(input(), 'operation-123');
    uid = 'student-b';
    expect(await api.list()).toEqual([]);
    await expect(api.get(saved.id)).rejects.toThrow('does not belong');
    await expect(api.source(saved.sources[0].id)).rejects.toThrow('could not be found');
    uid = null; await expect(api.list()).rejects.toThrow('Sign-in required');
  });
  it('keeps retry/confirmation states and requires explicit preview controls to reach ready', async () => {
    const api = createFixtureIntake(() => 'student-a');
    const saved = await api.create(input(), 'operation-123');
    await api.preview!(saved.id, 'failed');
    const retried = await api.retry(saved.id, 'retry-operation');
    expect(retried.id).toBe(saved.id); expect(retried.sources).toEqual(saved.sources);
    const review = await api.preview!(saved.id, 'needs_review');
    expect(review.outline?.exclusions[0]).toContain('no OCR');
    const outline = { ...review.outline!, title: 'My confirmed chapter' };
    await expect(api.confirm(saved.id, { ...outline, concepts: outline.concepts.map(c => ({ ...c, included: false })) }, 'confirm-operation')).rejects.toThrow('include at least one');
    expect((await api.confirm(saved.id, outline, 'confirm-operation')).status).toBe('generating');
    expect((await api.confirm(saved.id, outline, 'confirm-operation')).status).toBe('generating');
    expect((await api.get(saved.id)).status).toBe('generating');
    expect((await api.preview!(saved.id, 'ready')).status).toBe('ready');
  });
  it('rejects misleading file types and does not store rejected uploads', async () => {
    const api = createFixtureIntake(() => 'student-a');
    const fake = new File(['not really a PDF'], 'bad.pdf', { type: 'application/pdf' });
    expect(await validateMaterial(fake)).toContain('does not match');
    await expect(api.create({ ...input(), files: [fake] }, 'operation-123')).rejects.toThrow('does not match');
    expect(await api.list()).toEqual([]);
    expect(await validateMaterial(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toContain('use a PDF');
    expect(await validateMaterial(new File([], 'empty.pdf', { type: 'application/pdf' }))).toContain('non-empty');
  });
});
