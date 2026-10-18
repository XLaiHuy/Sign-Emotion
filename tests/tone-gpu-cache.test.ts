import { afterEach, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('onnxruntime-web/webgpu', () => ({
  env: { wasm: {} },
  InferenceSession: { create: runtime.create },
}));
import { ToneGpuModel } from '../src/infrastructure/inference/tone-gpu-model';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('initializes verified weights in RAM if optional cache storage is full', async () => {
  const bytes = new ArrayBuffer(8);
  // Avoid allocating a 356 MiB fixture; the hash verifier is mocked explicitly.
  Object.defineProperty(bytes, 'byteLength', { value: 373187428 });
  const hex = '0a69fa36b526befc0ab928ccee68b0386c9fa9fdb4fa7973cac53d0ae0fc7389';
  const digest = Uint8Array.from(hex.match(/../g)!, (pair) => parseInt(pair, 16)).buffer;
  vi.stubGlobal('crypto', { subtle: { digest: vi.fn(async () => digest) } });
  vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn(async () => ({})) } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes })),
  );
  vi.stubGlobal('caches', {
    open: vi.fn(async () => ({
      match: async () => undefined,
      put: async () => {
        throw new DOMException('Full', 'QuotaExceededError');
      },
    })),
  });
  const release = vi.fn(async () => {});
  runtime.create.mockResolvedValue({ release });
  const model = new ToneGpuModel();
  await model.prepare();
  expect(model.cacheAvailable).toBe(false);
  expect(runtime.create).toHaveBeenCalledTimes(1);
  await model.dispose();
  expect(release).toHaveBeenCalled();
});
