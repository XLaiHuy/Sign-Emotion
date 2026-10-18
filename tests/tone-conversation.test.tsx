import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useConversation } from '../src/features/conversation/useConversation';
import type { ConversationVault } from '../src/infrastructure/storage/vault';
const mocks = vi.hoisted(() => ({
  infer: vi.fn(),
  dispose: vi.fn(),
  start: vi.fn(async () => true),
  stop: vi.fn(),
}));
vi.mock('../src/infrastructure/inference/toneSession', () => ({
  ToneSession: class {
    prepare = async () => {};
    infer = mocks.infer;
    dispose = mocks.dispose;
  },
}));
vi.mock('../src/infrastructure/media/microphone', () => ({
  MicrophoneCapture: class {
    start = mocks.start;
    stop = mocks.stop;
  },
}));
class ModelWorker extends EventTarget {
  static instances: ModelWorker[] = [];
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  terminated = false;
  messages: Record<string, unknown>[] = [];
  constructor(readonly url: string | URL) {
    super();
    ModelWorker.instances.push(this);
  }
  send(data: unknown) {
    const event = new MessageEvent('message', { data });
    this.dispatchEvent(event);
    this.onmessage?.(event);
  }
  postMessage(data: Record<string, unknown>) {
    this.messages.push(data);
    queueMicrotask(() => {
      if (data.type === 'init') this.send({ type: 'ready' });
      if (data.type === 'transcribe')
        this.send({
          type: 'result',
          segment: {
            id: data.id,
            startMs: data.startMs,
            endMs: data.endMs,
            text: 'Hôm nay tôi buồn.',
            modelVersion: 'fixture',
            processingMs: 10,
            finalizedAtMs: performance.now(),
          },
        });
      if (data.type === 'infer')
        this.send({
          type: 'result',
          id: data.id,
          evidence: [
            {
              source: 'text',
              startMs: data.startMs,
              endMs: data.endMs,
              scores: { sad: 0.9 },
              unsupportedScore: 0.1,
              quality: 'usable',
              modelVersion: 'fixture',
            },
          ],
        });
    });
  }
  terminate() {
    this.terminated = true;
  }
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  ModelWorker.instances = [];
});
async function open() {
  vi.stubGlobal('Worker', ModelWorker);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const hook = renderHook(() => useConversation({ unlocked: false } as ConversationVault));
  await act(async () => {
    await hook.result.current.prepare();
    await hook.result.current.prepareTone();
  });
  await act(async () => {
    await hook.result.current.start({ emotion: true, tone: true, persist: false });
  });
  await waitFor(() => expect(hook.result.current.state).toBe('running'));
  return hook;
}
function speak(boundary = 'silence') {
  const vad = ModelWorker.instances.find((w) => String(w.url).includes('vad.worker'))!;
  vad.send({
    type: 'chunk',
    id: 'one',
    samples: new Float32Array(32000).fill(0.04),
    startSample: 0,
    endSample: 32000,
    boundary,
    utteranceId: 'speech',
    quality: { speechRms: 0.04, noiseRms: 0.001, noiseMeasured: true, clippingRatio: 0 },
  });
}
it('feeds the existing captured PCM to tone and combines text/voice without another microphone', async () => {
  mocks.infer.mockImplementation(async (_pcm, startMs, endMs) => ({
    source: 'voice',
    startMs,
    endMs,
    scores: { sad: 0.85 },
    unsupportedScore: 0.15,
    quality: 'usable',
    modelVersion: 'fixture-tone',
  }));
  const hook = await open();
  await act(async () => {
    speak();
  });
  await waitFor(() => expect(hook.result.current.record?.decisions[0]?.label).toBe('sad'));
  expect(hook.result.current.record?.decisions[0].contributors).toEqual(['text', 'voice']);
  expect(mocks.infer.mock.calls[0][0]).toHaveLength(32000);
  expect(mocks.start).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.cancel());
  expect(mocks.dispose).toHaveBeenCalled();
  expect(ModelWorker.instances.every((w) => w.terminated)).toBe(true);
});
it('ignores tone that arrives after cancellation', async () => {
  let resolve!: (value: undefined) => void;
  mocks.infer.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const hook = await open();
  await act(async () => {
    speak();
  });
  await waitFor(() => expect(mocks.infer).toHaveBeenCalled());
  act(() => hook.result.current.cancel());
  await act(async () => {
    resolve(undefined);
  });
  expect(hook.result.current.state).toBe('idle');
  expect(hook.result.current.record?.decisions).toHaveLength(0);
});
it('runs tone for a hard-cut caption without treating it as complete text semantics', async () => {
  mocks.infer.mockImplementation(async (_pcm, startMs, endMs) => ({
    source: 'voice',
    startMs,
    endMs,
    scores: { sad: 0.85 },
    unsupportedScore: 0.15,
    quality: 'usable',
    modelVersion: 'fixture-tone',
  }));
  const hook = await open();
  await act(async () => {
    speak('limit');
  });
  await waitFor(() => expect(mocks.infer).toHaveBeenCalledTimes(1));
  expect(
    ModelWorker.instances
      .filter((w) => String(w.url).includes('emotion.worker'))
      .flatMap((w) => w.messages)
      .filter((m) => m.type === 'infer'),
  ).toHaveLength(0);
  expect(hook.result.current.record?.segments).toHaveLength(1);
});
