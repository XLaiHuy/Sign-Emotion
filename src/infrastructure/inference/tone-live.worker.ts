/// <reference lib="webworker" />
import { ToneGpuModel } from './tone-gpu-model';
import { toneAudioUsable } from '../../domain/toneQuality';
const model = new ToneGpuModel();
let busy = false;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      await model.prepare();
      if (!model.cacheAvailable) self.postMessage({ type: 'cache-warning' });
      // Compile the common three-second shape before opening devices.
      // This checkpoint normalizes waveform variance; all-zero warm-up is invalid.
      const warm = Float32Array.from(
        { length: 48000 },
        (_, i) => 0.03 * Math.sin((2 * Math.PI * 220 * i) / 16000),
      );
      await model.infer(warm, 0, 3000);
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'infer') {
      if (busy) throw new Error('Overlapping tone');
      busy = true;
      const started = performance.now();
      const evidence = toneAudioUsable(data.samples, data.quality)
        ? await model.infer(data.samples, data.startMs, data.endMs)
        : undefined;
      self.postMessage({ type: 'result', evidence, processingMs: performance.now() - started });
    }
  } catch {
    self.postMessage({ type: 'error', reason: 'worker-failed' });
  } finally {
    busy = false;
  }
};
