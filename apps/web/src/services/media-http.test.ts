import { expect, it, vi } from 'vitest';
import preview from '../fixtures/concept-media-C-AM-08.json';
import { MediaManifestSchema } from '../contracts/concept-media';
import type { AuthService } from '../contracts/services';
import { createMediaApi } from './media-http';

const auth = { getIdToken: async () => 'synthetic-unit-token' } as AuthService;
const rendition = MediaManifestSchema.parse(preview.manifest).narration[0];
const bytes = new Uint8Array(new ArrayBuffer(rendition.bytes)).fill(7);
const digest = async (data: Uint8Array<ArrayBuffer>) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('');

it('reads the manifest with the bearer token and checks it belongs to the concept', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ manifest: preview.manifest }));
  const api = createMediaApi('http://localhost/', auth, fetcher);
  const manifest = await api.getManifest('C-AM-08', new AbortController().signal);
  expect(manifest.mediaRevision).toBe(preview.manifest.mediaRevision);
  expect(fetcher.mock.calls[0][0]).toBe('http://localhost/concepts/C-AM-08/media');
  expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer synthetic-unit-token' } });
  await expect(api.getManifest('C-AM-07')).rejects.toThrow('another concept');
});

it('never falls back to sample media when the connected service has none', async () => {
  const api = createMediaApi('http://localhost', auth, async () => new Response('', { status: 404 }));
  await expect(api.getManifest('C-AM-08')).rejects.toThrow('no published audio');
  const down = createMediaApi('http://localhost', auth, async () => new Response('', { status: 503 }));
  await expect(down.getManifest('C-AM-08')).rejects.toThrow('The text is complete');
  const odd = createMediaApi('http://localhost', auth, async () => Response.json({ manifest: { ...preview.manifest, schema: 'other' } }));
  await expect(odd.getManifest('C-AM-08')).rejects.toThrow('not supported');
});

it('plays a clip only after its exact bytes are verified, as a revocable local URL', async () => {
  const good = { ...rendition, audioSha256: await digest(bytes), assetId: await digest(bytes) };
  const fetcher = vi.fn<typeof fetch>(async () => new Response(bytes, { headers: { 'Content-Type': 'audio/wav' } }));
  const api = createMediaApi('http://localhost', auth, fetcher);
  const media = await api.loadNarration('C-AM-08', preview.manifest.mediaRevision, good);
  expect(fetcher.mock.calls[0][0]).toBe(`http://localhost/concepts/C-AM-08/media/${preview.manifest.mediaRevision}/assets/${good.assetId}`);
  expect(media.url).toMatch(/^blob:/);
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  media.release(); media.release();
  expect(revoke).toHaveBeenCalledTimes(1);
  await expect(api.loadNarration('C-AM-08', preview.manifest.mediaRevision, rendition)).rejects.toThrow('could not be verified');
  const short = createMediaApi('http://localhost', auth, async () => new Response(bytes.slice(1), { headers: { 'Content-Type': 'audio/wav' } }));
  await expect(short.loadNarration('C-AM-08', preview.manifest.mediaRevision, good)).rejects.toThrow('incomplete');
  const html = createMediaApi('http://localhost', auth, async () => new Response(bytes, { headers: { 'Content-Type': 'text/html' } }));
  await expect(html.loadNarration('C-AM-08', preview.manifest.mediaRevision, good)).rejects.toThrow('unexpected type');
});
