import { afterEach, expect, it, vi } from 'vitest';

vi.mock('onnxruntime-web/wasm', () => ({
  env: { wasm: {} },
  Tensor: class {
    dispose() {}
  },
  InferenceSession: {
    create: async () => ({
      run: async () => ({
        stateN: { data: new Float32Array(256), dispose() {} },
        output: { data: [0.9], dispose() {} },
      }),
    }),
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  { streaming: false, lengths: [12800, 25600, 38400] },
  { streaming: true, lengths: [8192, 16384, 24576, 32768, 40960] },
])(
  'copies only due partial windows (streaming=$streaming) while preserving final PCM',
  async ({ streaming, lengths }) => {
    vi.resetModules();
    // Import the same module instance that the worker will use after resetModules.
    const { UtteranceBuilder: Builder } = await import('../src/domain/audio');
    const snapshots = vi.spyOn(Builder.prototype, 'snapshot');
    const posted: { type: string; revision?: number; samples?: Float32Array }[] = [];
    const scope = {
      onmessage: null as unknown as (event: { data: object }) => void,
      postMessage: (data: (typeof posted)[number]) => posted.push(data),
    };
    vi.stubGlobal('self', scope);
    await import('../src/infrastructure/inference/vad.worker');
    scope.onmessage({ data: { type: 'init', earlyPartials: true, streaming } });
    for (let i = 0; i < 94; i++)
      scope.onmessage({
        data: { type: 'frame', samples: new Float32Array(512).fill(0.1), offset: i * 512 },
      });
    scope.onmessage({ data: { type: 'flush' } });
    await vi.waitFor(() => expect(posted.some((item) => item.type === 'flushed')).toBe(true));
    expect(snapshots).toHaveBeenCalledTimes(lengths.length);
    expect(
      posted.filter((item) => item.type === 'interim').map((item) => item.samples?.length),
    ).toEqual(lengths);
    expect(
      posted.filter((item) => item.type === 'chunk').map((item) => item.samples?.length),
    ).toEqual([94 * 512]);
  },
);
