/// <reference lib="webworker" />
import { createSpeechAdapter } from './asr-adapter';
import { speechError } from '../../domain/speechMetrics';
import type { AsrAdapter } from '../../domain/asr';

let busy = false;
self.onmessage = async ({ data }) => {
  if (busy || data.type !== 'compare') return;
  busy = true;
  let adapter: AsrAdapter | undefined;
  try {
    const pcm = data.samples as Float32Array;
    if (
      !(pcm instanceof Float32Array) ||
      !pcm.length ||
      pcm.length > 480000 ||
      pcm.some((v) => !Number.isFinite(v) || Math.abs(v) > 1) ||
      typeof data.reference !== 'string' ||
      data.reference.length > 10000
    )
      throw new Error('Invalid input');
    const rows = [];
    for (const profile of ['phowhisper', 'gipformer-research'] as const) {
      adapter = createSpeechAdapter(profile);
      const started = performance.now();
      self.postMessage({ type: 'progress', profile });
      try {
        const prepared = await adapter.prepare();
        const prepareMs = performance.now() - started;
        const segment = await adapter.acceptPcm(
          { id: 'comparison', samples: pcm.slice(), startMs: 0, endMs: pcm.length / 16 },
          true,
        );
        rows.push({
          profile,
          modelVersion: prepared.modelVersion,
          status: 'ok',
          prepareMs,
          processingMs: segment.processingMs,
          seconds: pcm.length / 16000,
          rtf: segment.processingMs / (pcm.length / 16),
          metrics: data.reference.trim() ? speechError(data.reference, segment.text) : null,
          text: segment.text,
        });
      } catch {
        rows.push({ profile, status: 'unavailable' });
      } finally {
        await adapter.dispose();
        adapter = undefined;
      }
    }
    self.postMessage({
      type: 'result',
      rows,
      scope:
        'same PCM, sequential file decoding; no capture/VAD/partial latency or accuracy without reference',
    });
  } catch {
    self.postMessage({ type: 'error', code: 'asr-comparison-failed' });
  } finally {
    await adapter?.dispose();
    busy = false;
  }
};
