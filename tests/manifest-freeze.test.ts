import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
it('persists validated manifests before SW control and freezes each boot to one version', async () => {
  vi.resetModules();
  const asset = {
    url: '/models/local/test/model.onnx',
    bytes: 12,
    sha256: 'a'.repeat(64),
    source: 'fixture',
    license: 'MIT',
  };
  const manifest = {
    version: 'conversation-v2',
    packs: [{ id: 'speech', experimental: false, assets: [asset] }],
  };
  const stored = new Map<string, Response>();
  const cache = {
    keys: vi.fn(async () => []),
    match: vi.fn(async (url: string) => stored.get(url)?.clone()),
    put: vi.fn(async (url: string, response: Response) => {
      stored.set(url, response.clone());
    }),
  };
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  const fetch = vi.fn(async () => new Response(JSON.stringify(manifest)));
  vi.stubGlobal('fetch', fetch);
  const { loadPacks } = await import('../src/infrastructure/offline/packs');
  await loadPacks();
  expect(stored.has('/models/conversation-manifest.json')).toBe(true);
  fetch.mockRejectedValue(new TypeError('offline'));
  expect(await loadPacks()).toEqual(manifest.packs);
  expect(fetch).toHaveBeenCalledOnce();
  // A new page has no module memo; its offline fallback must use persisted metadata.
  vi.resetModules();
  const fresh = await import('../src/infrastructure/offline/packs');
  expect(await fresh.loadPacks()).toEqual(manifest.packs);
});
