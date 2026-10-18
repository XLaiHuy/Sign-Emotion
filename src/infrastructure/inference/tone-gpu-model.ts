import * as ort from 'onnxruntime-web/webgpu';
import { mapEmotionScores } from '../../domain/emotionScores';
import { TONE_PROFILE } from './tone-profile';
import type { ModalityEvidence } from '../../domain/conversation';

/** Explicit large-file GPU research probe; prepared explicitly before an experimental conversation. */
export class ToneGpuModel {
  private session: ort.InferenceSession | null = null;
  cacheAvailable = true;
  async prepare() {
    if (!navigator.gpu || !(await navigator.gpu.requestAdapter()))
      throw new Error('GPU unavailable');
    const url = '/research/emotion2vec-tone/tone.fp32.onnx';
    const cache = await caches.open('signemo-tone-fp32-v1').catch(() => null);
    const cached = await cache?.match(url).catch(() => undefined);
    const response = cached ?? (await fetch(url));
    if (!response.ok) throw new Error('GPU tone artifact unavailable');
    const bytes = await response.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (v) =>
      v.toString(16).padStart(2, '0'),
    ).join('');
    if (
      bytes.byteLength !== 373187428 ||
      hash !== '0a69fa36b526befc0ab928ccee68b0386c9fa9fdb4fa7973cac53d0ae0fc7389'
    ) {
      await cache?.delete(url).catch(() => undefined);
      throw new Error('GPU tone artifact mismatch');
    }
    if (!cached) {
      try {
        if (!cache) throw new Error('Cache unavailable');
        await cache.put(url, new Response(bytes));
      } catch {
        // Optional cache failure must not discard a verified model already in RAM.
        this.cacheAvailable = false;
      }
    }
    ort.env.wasm.wasmPaths = '/research/runtime-ort-gpu/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    this.session = await ort.InferenceSession.create(bytes, {
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all',
    });
  }
  async infer(samples: Float32Array, startMs: number, endMs: number): Promise<ModalityEvidence> {
    if (
      !this.session ||
      samples.length < 12800 ||
      samples.length > 49152 ||
      samples.some((value) => !Number.isFinite(value) || Math.abs(value) > 1)
    )
      throw new Error('Invalid GPU tone input');
    const input = new ort.Tensor('float32', samples, [1, samples.length]);
    let output: ort.InferenceSession.ReturnType | undefined;
    try {
      output = await this.session.run({ input });
      return {
        source: 'voice',
        startMs,
        endMs,
        ...mapEmotionScores(output.signemo_tone_logits.data as Float32Array, [
          ...TONE_PROFILE.labels,
        ]),
        quality: 'usable',
        modelVersion: 'emotion2vec-plus-base-fp32-gpu-research-v1',
      };
    } finally {
      input.dispose();
      if (output) Object.values(output).forEach((item) => item.dispose());
    }
  }
  async dispose() {
    const session = this.session;
    this.session = null;
    await session?.release();
  }
}
