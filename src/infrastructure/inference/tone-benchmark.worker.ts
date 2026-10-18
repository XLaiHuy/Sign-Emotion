/// <reference lib="webworker" />
import type { ToneModel } from './tone-model';
import { TONE_PROFILE } from './tone-profile';

// An explicit compatibility probe, never opened by ordinary product startup.
self.onmessage = async ({ data }) => {
  const gpu = data.backend === 'webgpu-fp32';
  let tone: Pick<ToneModel, 'prepare' | 'infer' | 'dispose'> | undefined;
  try {
    if (data.type !== 'benchmark') throw new Error('Invalid request');
    tone = gpu
      ? new (await import('./tone-gpu-model')).ToneGpuModel()
      : new (await import('./tone-model')).ToneModel();
    const started = performance.now();
    await tone.prepare();
    const prepareMs = performance.now() - started;
    const rows = [];
    for (const count of [12800, 25600, 48000]) {
      const samples =
        data.fixtures?.find((item: { samples: Float32Array }) => item.samples.length === count)
          ?.samples ??
        Float32Array.from(
          { length: count },
          (_, i) => 0.05 * Math.sin((2 * Math.PI * 170 * i) / 16000),
        );
      const began = performance.now();
      const evidence = await tone.infer(samples, 0, count / 16);
      rows.push({ samples: count, processingMs: performance.now() - began, evidence });
    }
    const warmRows: { samples: number; processingMs: number }[] = [];
    const variableRows: { samples: number; processingMs: number }[] = [];
    if (data.extended === true) {
      const fixture = data.fixtures?.find(
        (item: { samples: Float32Array }) => item.samples.length === 48000,
      )?.samples;
      if (fixture) {
        for (const count of [48000, 48000, 48000, 48000, 48000, 14336, 28160]) {
          const samples = fixture.slice(0, count);
          const began = performance.now();
          await tone.infer(samples, 0, count / 16);
          (count === 48000 ? warmRows : variableRows).push({
            samples: count,
            processingMs: performance.now() - began,
          });
        }
      }
    }
    self.postMessage({
      type: 'result',
      version: gpu ? 'emotion2vec-plus-base-fp32-gpu-research-v1' : TONE_PROFILE.version,
      prepareMs,
      rows,
      warmRows,
      variableRows,
    });
  } catch (error) {
    // Map SDK errors to fixed codes; never forward arbitrary exception text.
    const message = error instanceof Error ? error.message : '';
    const code =
      message === 'GPU unavailable'
        ? 'gpu-unavailable'
        : message.includes('artifact mismatch')
          ? 'tone-checksum-failed'
          : message.includes('artifact unavailable')
            ? 'tone-file-missing'
            : /CSP|content security|unsafe-eval|EvalError/iu.test(message)
              ? 'gpu-csp-blocked'
              : /fetch|import/iu.test(message)
                ? 'gpu-runtime-unavailable'
                : /unsupported|not supported|data type|operator/iu.test(message)
                  ? 'gpu-operator-unsupported'
                  : /backend/iu.test(message)
                    ? 'gpu-backend-unavailable'
                    : 'tone-compatibility-failed';
    self.postMessage({ type: 'error', code });
  } finally {
    await tone?.dispose();
    self.close();
  }
};
