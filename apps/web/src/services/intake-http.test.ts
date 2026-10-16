import { describe, expect, it, vi } from 'vitest';
import { createIntakeApi } from './intake-http';
import type { AuthService } from '../contracts/services';
import { COURSE } from '../contracts/profile';
const auth = { getIdToken: async () => 'synthetic-unit-token' } as AuthService;
describe('real intake transport', () => {
  it('uses multipart data, bearer auth and the same operation key on retry without setting a broken boundary', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('', { status: 503 }));
    const api = createIntakeApi('http://localhost/v1', auth, fetcher);
    const input = { courseId: COURSE.id, kind: 'notes' as const, topic: COURSE.chapter, note: '', classDate: '', files: [new File(['%PDF-1.4\ntest'], 'notes.pdf', { type: 'application/pdf' })] };
    await expect(api.create(input, 'repeat-safe-key')).rejects.toThrow('could not complete');
    await expect(api.create(input, 'repeat-safe-key')).rejects.toThrow('could not complete');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const options = fetcher.mock.calls[0][1] as unknown as RequestInit;
    expect(options.headers).toEqual({ Authorization: 'Bearer synthetic-unit-token', 'Idempotency-Key': 'repeat-safe-key' });
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).getAll('files')).toHaveLength(1);
    expect(JSON.parse((options.body as FormData).get('context') as string)).not.toHaveProperty('ownerLearnerId');
  });
  it('rejects malformed responses and ownership denial without swapping to preview data', async () => {
    await expect(createIntakeApi('http://localhost', auth, async () => new Response('{"requests":[{"status":"ready"}]}')).list()).rejects.toThrow('unsupported response');
    await expect(createIntakeApi('http://localhost', auth, async () => new Response('private details', { status: 403 })).get('request')).rejects.toThrow('do not have access');
  });
});

it('preserves actionable boundary errors for unavailable Storage and invalid files', async () => {
  const message = 'Cloud file storage is not configured yet. Your files were not uploaded.';
  const api = createIntakeApi('http://localhost', auth, async () => Response.json({ detail: message }, { status: 503 }));
  await expect(api.list()).rejects.toThrow(message);
});
it('accepts stored receipts, follows explicit page cursors and never invents a ready lesson', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ requests: [], nextCursor: 'older-page' }));
  const api = createIntakeApi('http://localhost', auth, fetcher);
  expect(await api.listPage!()).toEqual({ requests: [], nextCursor: 'older-page' });
  await api.listPage!('older-page');
  expect(fetcher.mock.calls[1][0]).toBe('http://localhost/study-requests?cursor=older-page');
});
