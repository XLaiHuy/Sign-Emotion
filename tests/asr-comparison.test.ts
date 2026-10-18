import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  live: 0,
  maximum: 0,
  seen: [] as { profile: string; pcm: number[] }[],
  fail: false,
}));
vi.mock('../src/infrastructure/inference/asr-adapter', () => ({
  createSpeechAdapter: (profile: string) => ({
    prepare: async () => {
      state.live++;
      state.maximum = Math.max(state.maximum, state.live);
      if (state.fail && profile === 'gipformer-research') throw new Error('No assets');
      return { modelVersion: profile, fallback: false };
    },
    acceptPcm: async (request: { samples: Float32Array }) => {
      state.seen.push({ profile, pcm: Array.from(request.samples) });
      return { text: 'Tôi rất vui.', processingMs: 100 };
    },
    dispose: async () => {
      state.live--;
    },
  }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  state.live = state.maximum = 0;
  state.seen = [];
  state.fail = false;
});
async function compare(reference: string) {
  const messages: Record<string, unknown>[] = [];
  const host = {
    postMessage: (data: Record<string, unknown>) => messages.push(data),
    onmessage: undefined as unknown as (event: unknown) => Promise<void>,
  };
  vi.stubGlobal('self', host);
  await import('../src/infrastructure/inference/asr-comparison.worker');
  await host.onmessage({
    data: { type: 'compare', samples: new Float32Array([0.1, 0.2]), reference },
  });
  return messages.find((item) => item.type === 'result') as {
    rows: { status: string; metrics: { wer: number } | null }[];
  };
}
it('uses identical PCM sequentially, disables fallback, and calculates WER only with reference', async () => {
  const report = await compare('Tôi rất vui.');
  expect(state.maximum).toBe(1);
  expect(state.live).toBe(0);
  expect(state.seen.map((item) => item.profile)).toEqual(['phowhisper', 'gipformer-research']);
  expect(state.seen[0].pcm).toEqual(state.seen[1].pcm);
  expect(report.rows.every((row) => row.metrics?.wer === 0)).toBe(true);
});
it('retains successful baseline when the candidate is unavailable and omits accuracy without labels', async () => {
  state.fail = true;
  const report = await compare('');
  expect(report.rows.map((row) => row.status)).toEqual(['ok', 'unavailable']);
  expect(report.rows[0].metrics).toBeNull();
  expect(state.live).toBe(0);
});
