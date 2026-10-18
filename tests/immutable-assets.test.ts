import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { immutableAssetUrl } from '../src/infrastructure/offline/immutableAssetUrl';
import { downloadCandidate } from '../src/infrastructure/offline/downloadCandidate';

const asset = {
  url: '/models/local/model.onnx',
  bytes: 4,
  sha256: '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a',
};
const addressed = `/immutable/${asset.sha256}${asset.url}`;
beforeEach(() => {
  vi.stubEnv('DEV', false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('addresses model bytes by digest without changing runtime/cache keys or allowing fixture paths', () => {
  expect(immutableAssetUrl(asset)).toBe(addressed);
  expect(asset.url).toBe('/models/local/model.onnx');
  expect(immutableAssetUrl({ ...asset, sha256: 'a'.repeat(64) })).not.toBe(addressed);
  expect(immutableAssetUrl({ url: asset.url })).toBeNull();
  for (const url of [
    'https://example.com/model.onnx',
    '/models/../secret',
    '/models/%2e%2e/secret',
    '/models/model.onnx?revision=old',
    '/research/evaluation/0.f32',
    '/models//model.onnx',
  ])
    expect(immutableAssetUrl({ ...asset, url })).toBeNull();
  expect(() => immutableAssetUrl({ ...asset, sha256: 'wrong' })).toThrow();
});

it('uses the immutable transport and keeps Range resumes on the exact same version', async () => {
  let step = 0;
  const fetcher = vi.fn<typeof fetch>(async () => {
    if (step++ === 0)
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(Uint8Array.of(1, 2));
          },
          pull(controller) {
            controller.error(new TypeError('Interrupted'));
          },
        }),
      );
    return new Response(Uint8Array.of(3, 4), {
      status: 206,
      headers: { 'Content-Range': 'bytes 2-3/4' },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  expect(await downloadCandidate(asset, () => {})).toEqual(Uint8Array.of(1, 2, 3, 4));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]).toEqual([addressed, expect.objectContaining({ cache: 'default' })]);
  expect(fetcher.mock.calls[1]).toEqual([
    addressed,
    expect.objectContaining({ headers: { Range: 'bytes=2-' } }),
  ]);
});

it.each([404, 200])(
  'falls back once for an older server (%s) and never caches its SPA HTML as a model',
  async (status) => {
    const probe =
      status === 404
        ? new Response('', { status })
        : new Response('<html>old app</html>', { headers: { 'Content-Type': 'text/html' } });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(probe)
      .mockResolvedValueOnce(new Response(Uint8Array.of(1, 2, 3, 4)));
    vi.stubGlobal('fetch', fetcher);
    expect(await downloadCandidate(asset, () => {})).toEqual(Uint8Array.of(1, 2, 3, 4));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe(addressed);
    expect(fetcher.mock.calls[1]).toEqual([
      asset.url,
      expect.objectContaining({ cache: 'reload' }),
    ]);
  },
);

it('bounds an unsupported-address probe plus network retries to four requests', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockRejectedValue(new TypeError('Offline'));
  vi.stubGlobal('fetch', fetcher);
  await expect(downloadCandidate(asset, () => {})).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it('does not change transport halfway through a partially downloaded version', async () => {
  let started = false;
  const fetcher = vi.fn<typeof fetch>(async () => {
    if (!started) {
      started = true;
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(Uint8Array.of(1, 2));
          },
          pull(c) {
            c.error(new TypeError('Interrupted'));
          },
        }),
      );
    }
    return new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', fetcher);
  await expect(downloadCandidate(asset, () => {})).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls.every((call) => call[0] === addressed)).toBe(true);
});
