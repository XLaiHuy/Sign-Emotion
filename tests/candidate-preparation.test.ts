import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const fixture = vi.hoisted(() => ({
  bytes: [1, 2, 3, 4],
  hash: '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a',
}));
vi.mock('../src/infrastructure/inference/gipformer-assets', () => ({
  GIPFORMER_MANIFEST: {
    profile: 'fixture',
    assets: [{ file: 'encoder.int8.onnx', size: 4, sha256: fixture.hash }],
  },
}));
vi.mock('../src/infrastructure/inference/face-model-profile', () => ({
  B0_PROFILE: { url: '/research/emotieff-b0/model.onnx', bytes: 4, sha256: fixture.hash },
}));
vi.mock('../src/infrastructure/inference/researchGpuRuntime', () => ({
  GPU_RUNTIME_ASSETS: [{ file: 'runtime.wasm', bytes: 4, sha256: fixture.hash }],
}));
import {
  candidateAssets,
  prepareCandidateAssets,
  candidateAssetsReady,
} from '../src/infrastructure/offline/candidateAssets';
import { forgetCachedAsset } from '../src/infrastructure/offline/assets';

let stores: Map<string, Map<string, Response>>;
beforeEach(() => {
  stores = new Map();
  vi.stubGlobal('caches', {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const rows = stores.get(name)!;
      return {
        match: async (key: string) => rows.get(key)?.clone(),
        put: async (key: string, response: Response) => {
          rows.set(key, response.clone());
        },
        delete: async (key: string) => rows.delete(key),
      };
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(fixture.bytes))),
  );
  candidateAssets.forEach((asset) => forgetCachedAsset(asset.cache, asset));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('verifies, reports bytes and reuses the same caches workers need without fetching again', async () => {
  expect(createHash('sha256').update(new Uint8Array(fixture.bytes)).digest('hex')).toBe(
    fixture.hash,
  );
  const progress = vi.fn();
  await prepareCandidateAssets(progress);
  expect(progress).toHaveBeenLastCalledWith(12, 12);
  expect(await candidateAssetsReady()).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(3);
  await prepareCandidateAssets(vi.fn());
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(
    stores.get('signemo-research-gipformer-v1')?.has('/research/gipformer/manifest.json'),
  ).toBe(true);
});

it('allows a progressing download past 120 seconds before any worker initialization', async () => {
  vi.useFakeTimers();
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        start(controller) {
          stream = controller;
        },
      }),
    ),
  );
  let settled = false;
  const pending = prepareCandidateAssets(vi.fn()).then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(121000);
  expect(settled).toBe(false);
  stream.enqueue(new Uint8Array(fixture.bytes));
  stream.close();
  await pending;
  expect(await candidateAssetsReady()).toBe(true);
});

it('never caches partial/corrupt bytes and honors cancellation', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array([4, 3, 2, 1])));
  await expect(prepareCandidateAssets(vi.fn())).rejects.toMatchObject({ code: 'integrity' });
  expect(stores.get(candidateAssets[0].cache)?.has(candidateAssets[0].url)).toBe(false);
  const abort = new AbortController();
  abort.abort();
  vi.mocked(fetch).mockClear();
  await expect(prepareCandidateAssets(vi.fn(), abort.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fetch).not.toHaveBeenCalled();
});

it('resumes an interrupted transfer by Range and still verifies the complete checksum', async () => {
  let reads = 0;
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        pull(controller) {
          if (!reads++) controller.enqueue(new Uint8Array([1, 2]));
          else controller.error(new TypeError('connection lost'));
        },
      }),
    ),
  );
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(new Uint8Array([3, 4]), {
      status: 206,
      headers: { 'Content-Range': 'bytes 2-3/4' },
    }),
  );
  await prepareCandidateAssets(vi.fn());
  expect(vi.mocked(fetch).mock.calls[1][1]?.headers).toEqual({ Range: 'bytes=2-' });
  expect(await candidateAssetsReady()).toBe(true);
});

it('stops after three connection failures instead of retrying forever', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('connection lost'));
  await expect(prepareCandidateAssets(vi.fn())).rejects.toMatchObject({ code: 'network' });
  expect(fetch).toHaveBeenCalledTimes(3);
});
