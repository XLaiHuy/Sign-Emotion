import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useConversation } from '../src/features/conversation/useConversation';
import type { ConversationVault } from '../src/infrastructure/storage/vault';

const capture = vi.hoisted(() => ({ start: vi.fn(async () => true), stop: vi.fn() }));
vi.mock('../src/infrastructure/media/microphone', () => ({
  MicrophoneCapture: class {
    start = capture.start;
    stop = capture.stop;
  },
}));
class LocalWorker extends EventTarget {
  static instances: LocalWorker[] = [];
  static ready = true;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  messages: any[] = [];
  terminated = false;
  constructor() {
    super();
    LocalWorker.instances.push(this);
  }
  postMessage(data: any) {
    this.messages.push(data);
    if (data.type === 'init' && LocalWorker.ready)
      queueMicrotask(() => this.emit({ type: 'ready' }));
  }
  emit(data: object) {
    const event = new MessageEvent('message', { data });
    this.dispatchEvent(event);
    this.onmessage?.(event);
  }
  terminate() {
    this.terminated = true;
  }
}
const options = {
  emotion: false,
  persist: false,
};
const vault = { unlocked: false } as ConversationVault;
it('stops on a real capture-clock gap instead of joining speech across missing audio', async () => {
  const { result, unmount } = renderHook(() => useConversation(vault));
  await act(async () => {
    await result.current.prepare();
  });
  await act(() => result.current.start(options));
  const onFrame = (
    capture.start.mock.calls[0] as unknown as [
      (samples: Float32Array, offset: number, at: number) => void,
    ]
  )[0];
  act(() => {
    onFrame(new Float32Array(512), 0, 1000);
    onFrame(new Float32Array(512), 512, 1700);
  });
  expect(result.current.state).toBe('idle');
  expect(result.current.error).toContain('gián đoạn');
  expect(LocalWorker.instances.every((worker) => worker.terminated)).toBe(true);
  expect(capture.stop).toHaveBeenCalled();
  unmount();
});
it('attaches delayed text readiness to the current session once without reopening capture', async () => {
  const { result, unmount } = renderHook(() => useConversation(vault));
  await act(async () => {
    await result.current.prepare();
  });
  await act(() => result.current.start(options));
  expect(LocalWorker.instances).toHaveLength(2);
  await act(async () => {
    result.current.enableContext();
    result.current.enableContext();
  });
  expect(LocalWorker.instances).toHaveLength(3);
  expect(capture.start).toHaveBeenCalledOnce();
  act(() => result.current.cancel());
  await act(async () => result.current.enableContext());
  expect(LocalWorker.instances).toHaveLength(3);
  expect(LocalWorker.instances.every((worker) => worker.terminated)).toBe(true);
  unmount();
});
beforeEach(() => {
  LocalWorker.instances = [];
  LocalWorker.ready = true;
  capture.start.mockClear();
  capture.stop.mockClear();
  vi.stubGlobal('Worker', LocalWorker);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('requires a prewarmed profile before start and cancels preparation without opening capture', async () => {
  LocalWorker.ready = false;
  const { result, unmount } = renderHook(() => useConversation(vault));
  let preparation!: ReturnType<typeof result.current.prepare>;
  act(() => {
    preparation = result.current.prepare();
  });
  expect(LocalWorker.instances).toHaveLength(2);
  act(() => result.current.disposePrepared());
  await act(async () => {
    LocalWorker.instances.forEach((w) => w.emit({ type: 'ready' }));
    await preparation;
  });
  await act(() => result.current.start(options));
  expect(capture.start).not.toHaveBeenCalled();
  expect(LocalWorker.instances.every((w) => w.terminated)).toBe(true);
  expect(result.current.state).toBe('idle');
  expect(result.current.error).toContain('chưa sẵn sàng');
  unmount();
});
it('stops capture on bounded queue overflow and ignores late results after teardown', async () => {
  const { result, unmount } = renderHook(() => useConversation(vault));
  await act(async () => {
    expect(await result.current.prepare()).toBe(true);
  });
  await act(() => result.current.start(options));
  const [asr, vad] = LocalWorker.instances;
  act(() => {
    for (let i = 0; i < 5; i++)
      vad.emit({
        type: 'chunk',
        samples: new Float32Array(16000),
        startSample: i * 16000,
        endSample: (i + 1) * 16000,
      });
  });
  expect(result.current.state).toBe('idle');
  expect(result.current.error).toContain('theo kịp');
  expect(capture.stop).toHaveBeenCalled();
  act(() => asr.emit({ type: 'result', segment: { id: asr.messages.at(-1).id, text: 'late' } }));
  expect(result.current.record?.segments).toHaveLength(0);
  unmount();
});
it('retains the finish deadline after an ASR result while optional emotion is stalled', async () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(() => useConversation(vault));
  await act(async () => {
    expect(await result.current.prepare()).toBe(true);
  });
  await act(() => result.current.start({ ...options, emotion: true }));
  const [asr, vad] = LocalWorker.instances;
  act(() =>
    vad.emit({ type: 'chunk', samples: new Float32Array(16000), startSample: 0, endSample: 16000 }),
  );
  act(() => result.current.finish());
  act(() => {
    vad.emit({ type: 'flushed' });
    asr.emit({
      type: 'result',
      segment: {
        id: asr.messages.at(-1).id,
        text: 'xin chào',
        startMs: 0,
        endMs: 1000,
        finalizedAtMs: 2000,
        processingMs: 100,
        modelVersion: 'test',
      },
    });
  });
  expect(result.current.state).toBe('finishing');
  await act(() => vi.advanceTimersByTimeAsync(60_001));
  expect(result.current.state).toBe('idle');
  expect(result.current.record?.segments[0].text).toBe('xin chào');
  expect(LocalWorker.instances.every((w) => w.terminated)).toBe(true);
  unmount();
});
it('keeps one emotion job in flight and replaces pending analysis with the newest caption', async () => {
  const { result, unmount } = renderHook(() => useConversation(vault));
  await act(async () => {
    expect(await result.current.prepare()).toBe(true);
  });
  await act(() => result.current.start({ ...options, emotion: true }));
  const [asr, vad, emotion] = LocalWorker.instances;
  const quality = { speechRms: 0.1, noiseRms: 0.001, clippingRatio: 0 };
  const samples = () => new Float32Array(16_000);
  const segment = (id: string) => ({
    id,
    text: `câu ${id}`,
    startMs: performance.now() - 1500,
    endMs: performance.now() - 100,
    finalizedAtMs: performance.now(),
    processingMs: 100,
    modelVersion: 'test',
  });
  const recognize = () => {
    const id = asr.messages.filter((message) => message.type === 'transcribe').at(-1).id;
    act(() => asr.emit({ type: 'result', segment: segment(id) }));
    return id;
  };
  const emitChunk = (index: number) =>
    act(() =>
      vad.emit({
        type: 'chunk',
        samples: samples(),
        startSample: index * 16_000,
        endSample: (index + 1) * 16_000,
        quality,
      }),
    );
  emitChunk(0);
  const firstId = recognize();
  emitChunk(1);
  const secondId = recognize();
  emitChunk(2);
  const thirdId = recognize();
  expect(
    emotion.messages.filter((message) => message.type === 'infer').map((message) => message.id),
  ).toEqual([firstId]);
  act(() => emotion.emit({ type: 'result', id: firstId, evidence: [] }));
  expect(
    emotion.messages.filter((message) => message.type === 'infer').map((message) => message.id),
  ).toEqual([firstId, thirdId]);
  expect(secondId).not.toBe(thirdId);
  unmount();
});

it('shows provisional ASR locally and gives a finalized caption priority over later partials', async () => {
  const { result, unmount } = renderHook(() => useConversation(vault));
  await act(async () => {
    expect(await result.current.prepare()).toBe(true);
  });
  await act(() => result.current.start(options));
  const [asr, vad] = LocalWorker.instances;
  const quality = { speechRms: 0.1, noiseRms: 0.001, clippingRatio: 0 };
  const samples = new Float32Array(16_000);
  act(() =>
    vad.emit({
      type: 'interim',
      id: 'utterance-0',
      revision: 1,
      samples: samples.slice(),
      startSample: 0,
      endSample: 16_000,
      quality,
    }),
  );
  expect(asr.messages.at(-1).type).toBe('interim');
  act(() =>
    vad.emit({
      type: 'chunk',
      id: 'utterance-0',
      samples: samples.slice(),
      startSample: 0,
      endSample: 16_000,
      quality,
    }),
  );
  expect(asr.messages.filter((message) => message.type === 'transcribe')).toHaveLength(0);
  act(() =>
    asr.emit({
      type: 'partial',
      revision: 1,
      segment: { id: 'utterance-0', text: 'Xin chào' },
    }),
  );
  expect(result.current.provisional?.text).toBe('Xin chào');
  expect(asr.messages.at(-1).type).toBe('transcribe');
  act(() =>
    asr.emit({
      type: 'result',
      segment: {
        id: 'utterance-0',
        text: 'Xin chào.',
        startMs: 0,
        endMs: 1000,
        finalizedAtMs: 1100,
        processingMs: 100,
        modelVersion: 'test',
      },
    }),
  );
  expect(result.current.record?.segments.map((segment) => segment.text)).toEqual(['Xin chào.']);
  expect(result.current.provisional).toBeNull();
  unmount();
});

it('keeps prefix agreement UI-only and lets final ASR correct the whole sentence', async () => {
  const { result, unmount } = renderHook(() => useConversation(vault));
  await act(async () => {
    await result.current.prepare();
  });
  await act(() => result.current.start(options));
  const [asr, vad] = LocalWorker.instances;
  const quality = { speechRms: 0.1, noiseRms: 0.001, clippingRatio: 0 };
  for (const [index, text] of [
    'Tôi đồng ý trả tiền',
    'Tôi đồng ý trả tiền nhé',
    'Tôi đồng',
  ].entries()) {
    act(() =>
      vad.emit({
        type: 'interim',
        id: 'locked',
        revision: index + 1,
        samples: new Float32Array(16000 + index * 12800),
        startSample: 0,
        endSample: 16000 + index * 12800,
        quality,
      }),
    );
    act(() => asr.emit({ type: 'partial', segment: { id: 'locked', text, processingMs: 1 } }));
  }
  expect(result.current.provisional?.text).toBe('Tôi đồng ý trả');
  expect(result.current.record?.segments).toHaveLength(0);
  act(() =>
    vad.emit({
      type: 'chunk',
      id: 'locked',
      samples: new Float32Array(16000),
      startSample: 0,
      endSample: 16000,
      quality,
    }),
  );
  act(() =>
    asr.emit({
      type: 'result',
      segment: {
        id: 'locked',
        text: 'Tôi không đồng ý trả tiền.',
        startMs: 0,
        endMs: 1000,
        finalizedAtMs: 1200,
        processingMs: 100,
        modelVersion: 'test',
      },
    }),
  );
  expect(result.current.provisional).toBeNull();
  expect(result.current.record?.segments[0].text).toBe('Tôi không đồng ý trả tiền.');
  unmount();
});

it('suspends repeated window decoding when partial ASR overloads without losing the final chunk', async () => {
  const { result, unmount } = renderHook(() => useConversation(vault));
  await act(async () => {
    expect(await result.current.prepare()).toBe(true);
  });
  await act(() => result.current.start(options));
  const [asr, vad] = LocalWorker.instances;
  const event = {
    id: 'utterance-0',
    revision: 1,
    startSample: 0,
    endSample: 16000,
    samples: new Float32Array(16000),
    quality: { speechRms: 0.1, noiseRms: 0.001, clippingRatio: 0 },
  };
  act(() => vad.emit({ type: 'interim', ...event }));
  act(() =>
    asr.emit({
      type: 'partial',
      revision: 1,
      segment: { id: event.id, text: 'Xin chào', processingMs: 1200 },
    }),
  );
  act(() =>
    vad.emit({
      type: 'interim',
      ...event,
      revision: 2,
      endSample: 32000,
      samples: new Float32Array(32000),
    }),
  );
  expect(asr.messages.filter((message) => message.type === 'interim')).toHaveLength(1);
  act(() =>
    vad.emit({ type: 'chunk', ...event, endSample: 48000, samples: new Float32Array(48000) }),
  );
  expect(asr.messages.at(-1).type).toBe('transcribe');
  expect(asr.messages.at(-1).samples).toHaveLength(48000);
  unmount();
});
