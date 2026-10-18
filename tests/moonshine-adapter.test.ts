import { afterEach, expect, it, vi } from 'vitest';
import { MoonshineStreamingAdapter } from '../src/infrastructure/inference/moonshine-adapter';

function request(id: string, samples: Float32Array, revision = 1) {
  return {
    id,
    samples,
    startMs: 100,
    endMs: 100 + (samples.length / 16000) * 1000,
    revision,
    utteranceId: 'speech-100',
  };
}

afterEach(() => vi.restoreAllMocks());

it('feeds only new PCM from cumulative VAD snapshots and closes after the final caption', async () => {
  const addAudio = vi.fn();
  const transcribe = vi
    .fn()
    .mockReturnValueOnce({ lines: [{ text: 'Xin chào' }] })
    .mockReturnValueOnce({ lines: [{ text: 'Xin chào bạn' }] })
    .mockReturnValueOnce({ lines: [{ text: 'Xin chào bạn.' }] });
  const closeStream = vi.fn();
  const stopStream = vi.fn();
  const createStream = vi.fn(() => ({
    start: vi.fn(),
    stop: stopStream,
    addAudio,
    transcribe,
    close: closeStream,
  }));
  const closeTranscriber = vi.fn();
  const adapter = new MoonshineStreamingAdapter(async () => ({
    transcriber: { createStream, close: closeTranscriber },
    forceUpdate: 1,
  }));

  await adapter.prepare();
  const partial1 = await adapter.acceptPcm(
    request('utterance-1600', new Float32Array(16000)),
    false,
  );
  const partial2 = await adapter.acceptPcm(
    request('utterance-1600', new Float32Array(24000), 2),
    false,
  );
  const final = await adapter.acceptPcm(
    { ...request('utterance-1600', new Float32Array(32000), 2), boundary: 'silence' },
    true,
  );

  expect(addAudio.mock.calls.map(([samples]) => samples.length)).toEqual([16000, 8000, 8000]);
  expect(createStream).toHaveBeenCalledTimes(1);
  expect(partial1.text).toBe('Xin chào');
  expect(partial2.revision).toBe(2);
  expect(final.text).toBe('Xin chào bạn.');
  expect(stopStream).toHaveBeenCalledOnce();
  expect(stopStream.mock.invocationCallOrder[0]).toBeLessThan(
    transcribe.mock.invocationCallOrder.at(-1)!,
  );
  expect(closeStream).toHaveBeenCalledTimes(1);
  await adapter.dispose();
  expect(closeTranscriber).toHaveBeenCalledTimes(1);
});

it('resets the active streaming context when the utterance changes', async () => {
  const streams = Array.from({ length: 2 }, () => ({
    start: vi.fn(),
    stop: vi.fn(),
    addAudio: vi.fn(),
    transcribe: vi.fn(() => ({ lines: [] })),
    close: vi.fn(),
  }));
  let streamIndex = 0;
  const createStream = vi.fn(() => streams[streamIndex++]);
  const adapter = new MoonshineStreamingAdapter(async () => ({
    transcriber: { createStream, close: vi.fn() },
    forceUpdate: 1,
  }));
  await adapter.prepare();
  await adapter.acceptPcm(request('utterance-a', new Float32Array(8000)), false);
  await adapter.acceptPcm(request('utterance-b', new Float32Array(8000)), false);

  expect(createStream).toHaveBeenCalledTimes(2);
  expect(streams[0].close).toHaveBeenCalledOnce();
  expect(streams[1].addAudio).toHaveBeenCalledWith(expect.any(Float32Array), 16000);
  await adapter.dispose();
  expect(streams[1].close).toHaveBeenCalledOnce();
});

it('keeps all missing PCM when intermediate partials are skipped and rejects backward windows', async () => {
  const addAudio = vi.fn(),
    stop = vi.fn(),
    close = vi.fn();
  const adapter = new MoonshineStreamingAdapter(async () => ({
    transcriber: {
      createStream: () => ({
        start: vi.fn(),
        stop,
        addAudio,
        transcribe: () => ({ lines: [] }),
        close,
      }),
      close: vi.fn(),
    },
    forceUpdate: 1,
  }));
  await adapter.prepare();
  await adapter.acceptPcm(request('a', new Float32Array(8192)), false);
  await expect(adapter.acceptPcm(request('a', new Float32Array(4096)), false)).rejects.toThrow();
  await adapter.acceptPcm(request('a', new Float32Array(40000), 5), true);
  expect(addAudio.mock.calls.map(([pcm]) => pcm.length)).toEqual([8192, 31808]);
  expect(stop).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  await adapter.dispose();
});
