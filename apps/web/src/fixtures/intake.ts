import { COURSE } from '../contracts/profile';
import { assertOwner, MAX_FILES, validateMaterial, type IntakeApi, type IntakeRequest, type Outline } from '../contracts/intake';
import { ServiceError } from '../services/types';
import { listRequests, readBlob, storeRequest } from './material-store';
import { SAMPLE_CONCEPTS } from './material-concepts';

export function createFixtureIntake(requireUid: () => string): IntakeApi {
  async function get(id: string) {
    const uid = requireUid();
    const request = (await listRequests()).find(r => r.id === id);
    if (!request) throw new ServiceError('This material could not be found.', 404);
    assertOwner(request, uid); if (requireUid() !== uid) throw new ServiceError('Your account changed.');
    return request;
  }
  const keep = async (request: IntakeRequest) => { assertOwner(request, requireUid()); return storeRequest({ ...request, updatedAt: new Date().toISOString() }); };
  const sameOutline = (a: Outline | null, b: Outline) => JSON.stringify(a) === JSON.stringify(b);
  return {
    list: async () => { const uid = requireUid(); const all = await listRequests(); if (requireUid() !== uid) throw new ServiceError('Your account changed.'); return all.filter(r => r.ownerLearnerId === uid).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); },
    get,
    create: async (input, key, signal) => {
      const uid = requireUid();
      if (input.courseId !== COURSE.id || !input.topic.trim() || input.files.length < 1 || input.files.length > MAX_FILES) throw new ServiceError('Choose the supported subject, topic and one to five files.');
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(key)) throw new ServiceError('Invalid upload operation.');
      const hashes: string[] = [];
      for (const file of input.files) {
        const error = await validateMaterial(file); if (error) throw new ServiceError(error);
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        hashes.push([...new Uint8Array(digest)].map(v => v.toString(16).padStart(2,'0')).join(''));
      }
      signal?.throwIfAborted();
      if (requireUid() !== uid) throw new ServiceError('Your account changed.');
      const id = `req-${key}`;
      const existing = (await listRequests()).find(r => r.id === id);
      if (existing) {
        assertOwner(existing, uid);
        if (existing.topic !== input.topic.trim() || existing.kind !== input.kind || existing.note !== input.note || existing.classDate !== input.classDate || existing.sources.length !== hashes.length || existing.sources.some((s,i) => s.sha256 !== hashes[i] || s.title !== input.files[i].name)) throw new ServiceError('This retry has different files or details. Start a new upload.');
        return existing;
      }
      const now = new Date().toISOString();
      const request: IntakeRequest = { schema: 'intake-view/v1', id, ownerLearnerId: uid, courseId: input.courseId, kind: input.kind, topic: input.topic.trim(), note: input.note, classDate: input.classDate, status: 'reading', outline: null, jobId: `preview-job-${key}`, lessonPlanId: null, failure: null, createdAt: now, updatedAt: now,
        sources: input.files.map((f,i) => ({ id: `src-${key}-${i}`, requestId: id, ownerLearnerId: uid, title: f.name, mime: f.type as 'application/pdf' | 'image/jpeg' | 'image/png', size: f.size, sha256: hashes[i], createdAt: now })) };
      signal?.throwIfAborted();
      return storeRequest(request, input.files.map((blob,i) => ({ id: request.sources[i].id, blob })));
    },
    confirm: async (id, outline) => {
      const request = await get(id);
      if (['generating', 'ready'].includes(request.status) && sameOutline(request.outline, outline)) return request;
      if (request.status !== 'needs_review' || !outline.title.trim() || !outline.concepts.some(c => c.included) || outline.concepts.some(c => !request.outline?.concepts.some(old => old.id === c.id))) throw new ServiceError('Check the outline and include at least one concept before confirming.');
      return keep({ ...request, outline, status: 'generating' });
    },
    retry: async id => {
      const request = await get(id);
      if (request.status === 'reading') return request;
      if (request.status !== 'failed' || !request.failure?.canRetry) throw new ServiceError('This material cannot be retried yet.');
      return keep({ ...request, status: 'reading', failure: null });
    },
    source: async id => {
      const uid = requireUid();
      const source = (await listRequests()).filter(r => r.ownerLearnerId === uid).flatMap(r => r.sources).find(s => s.id === id);
      if (!source) throw new ServiceError('This original could not be found.', 404);
      const blob = await readBlob(id); if (requireUid() !== uid) throw new ServiceError('Your account changed.');
      return { source, blob };
    },
    preview: async (id, stage) => {
      const request = await get(id);
      if (stage === 'needs_review') {
        if (request.status !== 'reading') throw new ServiceError('The sample must be at the reading stage.');
        return keep({ ...request, status: 'needs_review', outline: { title: COURSE.chapter, provisional: request.kind !== 'syllabus', concepts: SAMPLE_CONCEPTS.map(c => ({ ...c })), sourceIds: request.sources.map(s => s.id), exclusions: ['Preview outline only: no OCR or topic matching was performed on your file.'] } });
      }
      if (stage === 'ready') {
        if (request.status !== 'generating') throw new ServiceError('Confirm the outline first.');
        return keep({ ...request, status: 'ready', lessonPlanId: COURSE.chapterId });
      }
      if (request.status !== 'reading') throw new ServiceError('Failure preview is available while reading.');
      return keep({ ...request, status: 'failed', failure: { message: 'Sample failure: a page could not be read. No analysis of your file was performed.', canRetry: true } });
    },
  };
}
