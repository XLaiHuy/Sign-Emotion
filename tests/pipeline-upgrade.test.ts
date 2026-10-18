import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  conversationProfile,
  selectedSpeechAssets,
} from '../src/infrastructure/inference/conversationProfile';
import { numericPipelineMetric } from '../src/domain/pipelineMetrics';
import { emitPipelineMetric } from '../src/infrastructure/diagnostics/pipelineTelemetry';
import { warmClassifier } from '../src/infrastructure/inference/warmClassifier';
import type * as Ort from 'onnxruntime-web/wasm';
import { UtteranceBuilder } from '../src/domain/audio';
import { prepareResearchGpuRuntime } from '../src/infrastructure/inference/researchGpuRuntime';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

it('cancels GPU preparation before any work or during a runtime download', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = vi.spyOn(globalThis, 'fetch');
  await expect(prepareResearchGpuRuntime(controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fetch).not.toHaveBeenCalled();
  vi.stubGlobal('navigator', { serviceWorker: { controller: {} } });
  vi.stubGlobal('caches', {
    open: vi.fn(async () => ({ match: async () => undefined, delete: async () => true })),
  });
  const active = new AbortController();
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  fetch.mockImplementation((_url, init) => {
    expect(init?.signal).toBe(active.signal);
    started();
    return new Promise<Response>((_resolve, reject) => {
      active.signal.addEventListener(
        'abort',
        () => reject(new DOMException('Cancelled', 'AbortError')),
        { once: true },
      );
    });
  });
  const preparation = prepareResearchGpuRuntime(active.signal);
  const rejected = expect(preparation).rejects.toMatchObject({ name: 'AbortError' });
  await pending;
  active.abort();
  await rejected;
  expect(fetch).toHaveBeenCalledOnce();
});

it('allows an 800 ms experimental partial without changing final PCM or decoding silence tails', () => {
  const baseline = new UtteranceBuilder(),
    candidate = new UtteranceBuilder();
  const quiet = new Float32Array(512),
    speech = new Float32Array(512).fill(0.1);
  let offset = 0;
  for (let i = 0; i < 6; i++, offset += 512) {
    baseline.push(quiet, 0, offset);
    candidate.push(quiet, 0, offset);
  }
  for (let i = 0; i < 18; i++, offset += 512) {
    baseline.push(speech, 0.9, offset);
    candidate.push(speech, 0.9, offset);
  }
  expect(candidate.snapshot('early-candidate')).toBeNull();
  baseline.push(speech, 0.9, offset);
  candidate.push(speech, 0.9, offset);
  offset += 512;
  expect(baseline.snapshot()).toBeNull();
  expect(candidate.snapshot('early-candidate')?.samples.length).toBe(12800);
  for (let i = 0; i < 4; i++, offset += 512) {
    baseline.push(quiet, 0, offset);
    candidate.push(quiet, 0, offset);
  }
  expect(candidate.snapshot('early-candidate')).toBeNull();
  expect(candidate.flush()).toEqual(baseline.flush());
});

describe('explicit experimental profile', () => {
  it('prepares VAD without fetching unused Whisper models or ASR runtime in the candidate', () => {
    const assets = [
      { url: '/models/local/silero_vad.onnx' },
      { url: '/models/local/phowhisper/model.onnx' },
      { url: '/runtime/speech/runtime.wasm' },
    ];
    expect(selectedSpeechAssets(assets, 'pc-candidate')).toEqual([assets[0]]);
    expect(selectedSpeechAssets(assets, 'baseline')).toEqual(assets);
  });
  it('keeps ordinary and invalid builds on the baseline', () => {
    expect(conversationProfile('pc-candidate', 'moonshine')).toEqual({
      id: 'pc-candidate',
      asr: 'moonshine-streaming-vi-research',
      face: 'b0-webgpu-research',
    });
    expect(conversationProfile('baseline').asr).toBe('product');
    expect(conversationProfile('unknown').face).toBe('product');
    expect(conversationProfile('pc-candidate')).toEqual({
      id: 'pc-candidate',
      asr: 'gipformer-research',
      face: 'b0-webgpu-research',
    });
  });
});

describe('benchmark privacy boundary', () => {
  it('projects only finite numeric stage measurements and drops content', () => {
    expect(
      numericPipelineMetric({
        stage: 'asr-final',
        durationMs: 120,
        queue: 2,
        rtf: 0.4,
        text: 'private',
        label: 'angry',
        samples: [1],
      }),
    ).toEqual({ stage: 'asr-final', durationMs: 120, queue: 2, rtf: 0.4 });
    expect(numericPipelineMetric({ stage: 'transcript', durationMs: 1 })).toBeNull();
    expect(numericPipelineMetric({ stage: 'text', durationMs: NaN })).toBeNull();
    expect(
      numericPipelineMetric({ stage: 'text', durationMs: 1, queue: Infinity, rtf: -1 }),
    ).toEqual({ stage: 'text', durationMs: 1 });
  });
  it('is silent unless the local benchmark is explicitly enabled', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    emitPipelineMetric({ stage: 'text', durationMs: 12 });
    expect(dispatch).not.toHaveBeenCalled();
    window.history.replaceState({}, '', '/?benchmark=1');
    emitPipelineMetric({ stage: 'text', durationMs: 12 });
    expect(dispatch).toHaveBeenCalledOnce();
  });
});

describe('classifier preparation', () => {
  it.each([false, true])('releases warm-up tensors when inference fails=%s', async (failed) => {
    const disposeInput = vi.fn(),
      disposeOutput = vi.fn();
    const Tensor = vi.fn(function () {
      return { dispose: disposeInput };
    });
    const run = failed
      ? vi.fn().mockRejectedValue(new Error('provider failed'))
      : vi.fn().mockResolvedValue({ scores: { dispose: disposeOutput } });
    const inference = warmClassifier(
      { Tensor } as unknown as typeof Ort,
      { inputNames: ['input'], run } as unknown as Ort.InferenceSession,
      224,
    );
    if (failed) await expect(inference).rejects.toThrow('provider failed');
    else await inference;
    expect(disposeInput).toHaveBeenCalledOnce();
    expect(disposeOutput).toHaveBeenCalledTimes(failed ? 0 : 1);
  });
});
