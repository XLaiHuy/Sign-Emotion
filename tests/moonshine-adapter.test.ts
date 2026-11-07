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

it('freezes gain params across deltas in the same utterance and recalculates on new utterance', async () => {
  const addAudio = vi.fn();
  const createStream = vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    addAudio,
    transcribe: vi.fn(() => ({ lines: [{ text: 'bản dịch' }] })),
    close: vi.fn(),
  }));
  const adapter = new MoonshineStreamingAdapter(async () => ({
    transcriber: { createStream, close: vi.fn() },
    forceUpdate: 1,
  }));

  await adapter.prepare();

  // Utterance 1, chunk 1: 16000 samples with RMS ~0.02
  const chunk1 = new Float32Array(16000);
  for (let i = 0; i < chunk1.length; i++) {
    chunk1[i] = 0.028284 * Math.sin((2 * Math.PI * 200 * i) / 16000);
  }
  await adapter.acceptPcm({ ...request('utt-1', chunk1), gainNormalization: true }, false);
  const gain1 = adapter.currentGainParams.gain;
  expect(gain1).toBeGreaterThan(3.5);

  // Utterance 1, chunk 2: cumulative 24000 samples, new 8000 samples are louder (e.g. 0.06)
  const chunk2 = new Float32Array(24000);
  chunk2.set(chunk1, 0);
  for (let i = 16000; i < 24000; i++) {
    chunk2[i] = 0.0848 * Math.sin((2 * Math.PI * 200 * i) / 16000);
  }
  await adapter.acceptPcm({ ...request('utt-1', chunk2, 2), gainNormalization: true }, false);
  const gain2 = adapter.currentGainParams.gain;
  // Gain MUST be frozen across deltas within the same utterance
  expect(gain2).toBe(gain1);

  // Check that the delta fed to addAudio was scaled by gain1
  const fedDelta = addAudio.mock.calls[1][0] as Float32Array;
  expect(fedDelta.length).toBe(8000);
  const rawDelta = chunk2.subarray(16000);
  expect(fedDelta[100]).toBeCloseTo(rawDelta[100] * gain1, 4);

  // Finish utterance 1
  await adapter.acceptPcm(
    { ...request('utt-1', chunk2, 3), boundary: 'silence', gainNormalization: true },
    true,
  );
  // On closeStream, gainParams resets to gain=1, mean=0
  expect(adapter.currentGainParams.gain).toBe(1);

  // Utterance 2: new utterance with different loudness (e.g. 0.04)
  const chunk3 = new Float32Array(16000);
  for (let i = 0; i < chunk3.length; i++) {
    chunk3[i] = 0.05656 * Math.sin((2 * Math.PI * 200 * i) / 16000);
  }
  await adapter.acceptPcm({ ...request('utt-2', chunk3), gainNormalization: true }, false);
  const gain3 = adapter.currentGainParams.gain;
  // Gain is recalculated for new utterance
  expect(gain3).not.toBe(gain1);
  expect(gain3).toBeCloseTo(2, 1);

  await adapter.dispose();
});

