import { afterEach, expect, it, vi } from 'vitest';
import { ownWorkerChildren } from '../src/infrastructure/inference/ownedWorkerChildren';
import { disposeSpeechWorker } from '../src/infrastructure/inference/disposeSpeechWorker';
import { installSpeechWorker } from '../src/infrastructure/inference/speech.worker-core';
vi.mock('../src/infrastructure/inference/asr-adapter', () => ({
  createSpeechAdapter: vi.fn(),
}));
class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  constructor(_url?: unknown, _options?: unknown) {
    super();
    FakeWorker.instances.push(this);
  }
  terminated = vi.fn();
  terminate() {
    this.terminated();
  }
  postMessage = vi.fn();
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.instances = [];
});
it('terminates every WASM child and refuses a late child after its owner is disposed', () => {
  vi.stubGlobal('Worker', FakeWorker);
  const release = ownWorkerChildren();
  const a = new Worker('/runtime/a.mjs'),
    b = new Worker('/runtime/b.mjs');
  release();
  release();
  expect((a as unknown as FakeWorker).terminated).toHaveBeenCalledTimes(1);
  expect((b as unknown as FakeWorker).terminated).toHaveBeenCalledTimes(1);
  expect(() => new Worker('/runtime/late.mjs')).toThrow();
  expect(FakeWorker.instances.at(-1)?.terminated).toHaveBeenCalledTimes(1);
});
it('waits for streaming child cleanup acknowledgement before terminating the parent, with a finite fallback', async () => {
  vi.useFakeTimers();
  const worker = new FakeWorker() as unknown as Worker;
  const disposed = disposeSpeechWorker(worker, 'moonshine-streaming-vi-research');
  expect(disposeSpeechWorker(worker, 'moonshine-streaming-vi-research')).toBe(disposed);
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'dispose' });
  expect((worker as unknown as FakeWorker).terminated).not.toHaveBeenCalled();
  worker.dispatchEvent(new MessageEvent('message', { data: { type: 'disposed' } }));
  await disposed;
  expect((worker as unknown as FakeWorker).terminated).toHaveBeenCalledTimes(1);
  const stalled = new FakeWorker() as unknown as Worker;
  const timeout = disposeSpeechWorker(stalled, 'moonshine-streaming-vi-research');
  await vi.advanceTimersByTimeAsync(5000);
  await timeout;
  expect((stalled as unknown as FakeWorker).terminated).toHaveBeenCalledOnce();
});
it('preserves immediate shutdown for the other ASR workers', async () => {
  const worker = new FakeWorker() as unknown as Worker;
  await disposeSpeechWorker(worker, 'gipformer-research');
  expect((worker as unknown as FakeWorker).terminated).toHaveBeenCalledOnce();
  expect(worker.postMessage).not.toHaveBeenCalled();
});
it('closes the streaming owner event loop after child cleanup and disposal acknowledgement', async () => {
  const order: string[] = [];
  const owner = {
    postMessage: vi.fn(() => order.push('ack')),
    close: vi.fn(() => order.push('close')),
    onmessage: null as unknown as (event: { data: { type: string } }) => Promise<void>,
  };
  vi.stubGlobal('self', owner);
  installSpeechWorker(true, () => order.push('children'));
  await owner.onmessage({ data: { type: 'dispose' } });
  expect(owner.postMessage).toHaveBeenCalledWith({ type: 'disposed' });
  expect(order).toEqual(['children', 'ack', 'close']);
});
