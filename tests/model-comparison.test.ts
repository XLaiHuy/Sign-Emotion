import { afterEach, expect, it, vi } from 'vitest';
import { defaultSettings } from '../src/shared/contracts';
import { emptyResult } from '../src/domain/face/prediction';
import { faceProfileContract } from '../src/infrastructure/inference/face-model-profile';
import { timingSummary } from '../src/domain/benchmark';
const state = vi.hoisted(() => ({
  live: 0,
  maximum: 0,
  profiles: [] as string[],
  failGpu: false,
  noFace: false,
  abort: undefined as AbortController | undefined,
}));
vi.mock('../src/infrastructure/inference/videoInference', () => ({
  seekVideo: vi.fn(async () => {}),
  InferenceClient: class {
    ready: Promise<void>;
    closed = false;
    constructor(_candidate: unknown, _research: boolean, profile: string) {
      state.profiles.push(profile);
      state.live++;
      state.maximum = Math.max(state.maximum, state.live);
      this.ready =
        state.failGpu && profile.includes('webgpu')
          ? Promise.reject(new Error('Unavailable'))
          : Promise.resolve();
    }
    async infer(_video: unknown, timestamp: number) {
      state.abort?.abort();
      return {
        ...emptyResult(),
        timestamp,
        status: 'valid',
        observationUsable: true,
        scores: [0.01, 0.01, 0.01, 0.93, 0.01, 0.01, 0.01, 0.01],
        processingMs: 20,
        stages: {
          detectionMs: 8,
          cropMs: state.noFace ? 0 : 2,
          classifierMs: state.noFace ? 0 : 10,
        },
      };
    }
    close() {
      if (!this.closed) {
        this.closed = true;
        state.live--;
      }
    }
  },
}));
import {
  compareVideoFaces,
  selectedFaceComparisonProfiles,
} from '../src/infrastructure/inference/faceComparison';
import { seekVideo } from '../src/infrastructure/inference/videoInference';
afterEach(() => {
  state.live = state.maximum = 0;
  state.profiles = [];
  state.failGpu = false;
  state.noFace = false;
  state.abort = undefined;
  vi.clearAllMocks();
});
it('pins separate B0/B2 sizes and providers, never implicitly chooses GPU', () => {
  expect(selectedFaceComparisonProfiles('pc-candidate')).toEqual([
    'b0-wasm-research',
    'b0-webgpu-research',
  ]);
  expect(selectedFaceComparisonProfiles('baseline')).toContain('b2-webgpu-research');
  expect(faceProfileContract('product')).toMatchObject({ size: 260, backend: 'wasm' });
  expect(faceProfileContract('b0-wasm-research')).toMatchObject({ size: 224, backend: 'wasm' });
  expect(faceProfileContract('b0-webgpu-research')).toMatchObject({ size: 224, backend: 'webgpu' });
  expect(faceProfileContract('b2-webgpu-research')).toMatchObject({ size: 260, backend: 'webgpu' });
  expect(() => faceProfileContract('fake' as never)).toThrow();
});
it('compares identical timestamps with one worker and only scores provided labels', async () => {
  const reports = await compareVideoFaces(
    {} as HTMLVideoElement,
    1.2,
    defaultSettings,
    undefined,
    [{ startMs: 0, endMs: 1200, label: 'sad' }],
    new AbortController().signal,
    vi.fn(),
    vi.fn(),
  );
  expect(state.maximum).toBe(1);
  expect(state.live).toBe(0);
  expect(reports).toHaveLength(3);
  expect(reports.every((row) => row.samples === 6 && row.quality?.labeledSamples === 6)).toBe(true);
  const times = vi.mocked(seekVideo).mock.calls.map((call) => call[1]);
  expect(times.slice(0, 6)).toEqual(times.slice(6, 12));
  expect(times.slice(0, 6)).toEqual(times.slice(12));
});
it('marks unavailable GPUs without replacing them with WASM or manufacturing accuracy', async () => {
  state.failGpu = true;
  const reports = await compareVideoFaces(
    {} as HTMLVideoElement,
    0.6,
    defaultSettings,
    undefined,
    [],
    new AbortController().signal,
    vi.fn(),
    vi.fn(),
  );
  expect(reports.map((row) => row.status)).toEqual(['ok', 'unavailable', 'unavailable']);
  expect(reports[0].quality).toBeNull();
  expect(state.live).toBe(0);
});
it('cancels a comparison and releases its only worker before the next profile', async () => {
  const abort = new AbortController();
  state.abort = abort;
  await expect(
    compareVideoFaces(
      {} as HTMLVideoElement,
      1,
      defaultSettings,
      undefined,
      [],
      abort.signal,
      vi.fn(),
      vi.fn(),
    ),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(state.profiles).toHaveLength(1);
  expect(state.live).toBe(0);
});
it('does not count skipped crop/classifier stages as zero-latency inferences', async () => {
  state.noFace = true;
  const reports = await compareVideoFaces(
    {} as HTMLVideoElement,
    0.6,
    defaultSettings,
    undefined,
    [],
    new AbortController().signal,
    vi.fn(),
    vi.fn(),
  );
  expect(reports[0].detection?.samples).toBe(3);
  expect(reports[0].classifier).toEqual({ samples: 0, p50Ms: null, p95Ms: null });
  expect(reports[0].crop?.samples).toBe(0);
});
it('reports nearest-rank timings without mutating or claiming samples that do not exist', () => {
  const values = [300, 100, 200];
  expect(timingSummary(values)).toEqual({ samples: 3, p50Ms: 200, p95Ms: 300 });
  expect(values).toEqual([300, 100, 200]);
  expect(timingSummary([]).p95Ms).toBeNull();
});
