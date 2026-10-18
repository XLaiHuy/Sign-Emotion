import { afterEach, expect, it, vi } from 'vitest';
import {
  cachedOptionalMedia,
  optionalMediaSaved,
  saveOptionalMedia,
} from '../src/infrastructure/offline/optionalMedia';
import type { OptionalMediaAsset } from '../src/shared/optionalMedia';
import { introVideo, introCaptions } from '../src/shared/optionalMedia';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

afterEach(() => vi.unstubAllGlobals());
it('pins the actual local video and draft caption bytes distributed in Docker', () => {
  for (const asset of [introVideo, introCaptions]) {
    const bytes = readFileSync('public' + asset.url);
    expect(bytes.byteLength).toBe(asset.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
  }
});
async function setup() {
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  const asset: OptionalMediaAsset = {
    url: '/demo/fixture.mp4',
    bytes: 6,
    sha256: hash,
    contentType: 'video/mp4',
  };
  const data = new Map<string, Response>();
  const key = (url: string) => new URL(url, location.origin).href;
  const cache = {
    match: vi.fn(async (url: string) => data.get(key(url))?.clone()),
    put: vi.fn(async (url: string, response: Response) => {
      data.set(key(url), response);
    }),
    delete: vi.fn(async (url: string) => data.delete(key(url))),
  };
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  const fetcher = vi.fn(async () => new Response(bytes));
  vi.stubGlobal('fetch', fetcher);
  return { asset, cache, fetcher, bytes };
}
it('saves only explicit, checksum-verified media and serves offline byte ranges', async () => {
  const { asset, fetcher } = await setup();
  expect(await optionalMediaSaved(asset)).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
  await saveOptionalMedia(asset);
  expect(await optionalMediaSaved(asset)).toBe(true);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('offline');
    }),
  );
  const request = (range: string) =>
    new Request(new URL(asset.url, location.origin), { headers: { Range: range } });
  const middle = await cachedOptionalMedia(request('bytes=2-4'));
  expect(middle?.status).toBe(206);
  expect(middle?.headers.get('Content-Range')).toBe('bytes 2-4/6');
  expect([...new Uint8Array(await middle!.arrayBuffer())]).toEqual([2, 3, 4]);
  const suffix = await cachedOptionalMedia(request('bytes=-2'));
  expect([...new Uint8Array(await suffix!.arrayBuffer())]).toEqual([4, 5]);
  expect((await cachedOptionalMedia(request('bytes=99-')))?.status).toBe(416);
  expect((await cachedOptionalMedia(request('bytes=0-1,3-4')))?.status).toBe(416);
});
it('rejects corrupt, partial and aborted downloads without writing storage', async () => {
  const { asset, cache } = await setup();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(6))),
  );
  await expect(saveOptionalMedia(asset)).rejects.toThrow('không đúng phiên bản');
  expect(cache.put).not.toHaveBeenCalled();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(6), { status: 206 })),
  );
  await expect(saveOptionalMedia(asset)).rejects.toThrow();
  const abort = new AbortController();
  abort.abort();
  await expect(saveOptionalMedia(asset, abort.signal)).rejects.toThrow();
  expect(cache.put).not.toHaveBeenCalled();
});
it('treats storage rejection as an optional failure', async () => {
  const { asset, cache } = await setup();
  cache.put.mockRejectedValueOnce(new Error('quota'));
  await expect(saveOptionalMedia(asset)).rejects.toThrow('quota');
  expect(await optionalMediaSaved(asset)).toBe(false);
});
it('rejects insufficient quota before fetching media', async () => {
  const { asset, fetcher } = await setup();
  vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 10, usage: 8 }) } });
  await expect(saveOptionalMedia(asset)).rejects.toThrow('Chưa đủ dung lượng');
  expect(fetcher).not.toHaveBeenCalled();
});
