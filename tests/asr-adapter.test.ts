import { expect, it, vi } from 'vitest';
const factory = vi.hoisted(() => vi.fn());
vi.mock('@huggingface/transformers', () => ({
  env: { backends: { onnx: { wasm: {} } } },
  pipeline: factory,
}));
import { createSpeechAdapter } from '../src/infrastructure/inference/asr-adapter';

it('keeps partial/final timestamps and selected model version behind the same adapter', async () => {
  const model = Object.assign(
    vi.fn(async () => ({ text: 'Xin chào bạn' })),
    { dispose: vi.fn(async () => {}) },
  );
  factory.mockResolvedValue(model);
  const adapter = createSpeechAdapter('phowhisper');
  expect((await adapter.prepare()).fallback).toBe(false);
  const request = {
    id: 'one',
    samples: new Float32Array(16000),
    startMs: 100,
    endMs: 1100,
    utteranceId: 'u',
    boundary: 'silence' as const,
  };
  const result = await adapter.acceptPcm(request, false);
  expect(result).toMatchObject({
    id: 'one',
    startMs: 100,
    endMs: 1100,
    text: 'Xin chào bạn',
    utteranceId: 'u',
    boundary: 'silence',
  });
  adapter.reset();
  expect((await adapter.acceptPcm(request, true)).text).toBe('Xin chào bạn');
  await adapter.dispose();
  expect(model.dispose).toHaveBeenCalledOnce();
});
it('disposes a model that finishes preparing after cancellation', async () => {
  let complete!: (value: unknown) => void;
  const model = Object.assign(vi.fn(), { dispose: vi.fn(async () => {}) });
  factory.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const adapter = createSpeechAdapter('phowhisper');
  const ready = adapter.prepare();
  await adapter.dispose();
  complete(model);
  await expect(ready).rejects.toMatchObject({ name: 'AbortError' });
  expect(model.dispose).toHaveBeenCalledOnce();
});
