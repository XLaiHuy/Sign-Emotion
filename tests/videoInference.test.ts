import { describe, expect, it, vi, afterEach } from 'vitest';
import { InferenceClient, seekVideo } from '../src/infrastructure/inference/videoInference';
afterEach(() => vi.useRealTimers());
it('uses the candidate B0 worker in batch video rather than requesting a removed B2 fallback', async () => {
  const calls: unknown[] = [];
  class LocalWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror = null;
    postMessage(message: unknown) {
      calls.push(message);
      queueMicrotask(() =>
        this.onmessage?.(new MessageEvent('message', { data: { type: 'ready' } })),
      );
    }
    terminate() {}
  }
  vi.stubEnv('VITE_AI_PROFILE', 'pc-candidate');
  vi.stubGlobal('Worker', LocalWorker);
  const client = new InferenceClient();
  try {
    await client.ready;
    expect(calls[0]).toMatchObject({
      type: 'init',
      research: true,
      faceProfile: 'b0-webgpu-research',
    });
  } finally {
    client.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
describe('deterministic video seek', () => {
  it('rejects an aborted seek and cleans all listeners/timeouts', async () => {
    vi.useFakeTimers();
    const video = document.createElement('video'),
      abort = new AbortController();
    const pending = seekVideo(video, 2, abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('waits for seeked and fails bounded decoding timeouts', async () => {
    vi.useFakeTimers();
    const video = document.createElement('video');
    const pending = seekVideo(video, 1, new AbortController().signal);
    video.dispatchEvent(new Event('seeked'));
    await pending;
    expect(vi.getTimerCount()).toBe(0);
    const timeout = seekVideo(video, 3, new AbortController().signal);
    const assertion = expect(timeout).rejects.toThrow('quá lâu');
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
  });
});
