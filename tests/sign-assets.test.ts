import { afterEach, expect, it, vi } from 'vitest';
import { readSignAsset } from '../src/infrastructure/media/signAssets';
import type { SignAsset } from '../src/domain/sign/signAsset';
afterEach(() => vi.unstubAllGlobals());
const asset = (sha256: string): SignAsset => ({
  kind: 'video',
  url: '/signs/fixture.mp4',
  sha256,
  source: 'test-only',
  license: 'test fixture',
  selfChecked: true,
  technicalVerified: true,
});
it('rejects missing, substituted, non-video and oversized sign assets before playback', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
  await expect(readSignAsset(asset(hash), new AbortController().signal)).rejects.toThrow();
  fetcher.mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'video/mp4' } }));
  await expect(
    readSignAsset(asset('a'.repeat(64)), new AbortController().signal),
  ).rejects.toThrow();
  fetcher.mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'text/html' } }));
  await expect(readSignAsset(asset(hash), new AbortController().signal)).rejects.toThrow();
  fetcher.mockResolvedValueOnce(
    new Response(bytes, {
      headers: { 'content-type': 'video/mp4', 'content-length': String(17 * 1024 * 1024) },
    }),
  );
  await expect(readSignAsset(asset(hash), new AbortController().signal)).rejects.toThrow();
  fetcher.mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'video/mp4' } }));
  expect(new Uint8Array(await readSignAsset(asset(hash), new AbortController().signal))).toEqual(
    bytes,
  );
});
