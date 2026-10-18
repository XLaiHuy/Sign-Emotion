import * as ort from 'onnxruntime-web/wasm';
import { mapEmotionScores } from '../../domain/emotionScores';
import type { ModalityEvidence } from '../../domain/conversation';
import type { SpeechAudioQuality } from '../../domain/audio';

import { TONE_PROFILE } from './tone-profile';
export { TONE_PROFILE } from './tone-profile';

/** Research checkpoint, never inferred from pitch/volume rules or ASR text. */
export class ToneModel {
  private session: ort.InferenceSession | null = null;
  async prepare() {
    const cache = await caches.open('signemo-tone-experiment-v1');
    let response = await cache.match(TONE_PROFILE.url);
    if (!response) response = await fetch(TONE_PROFILE.url);
    if (!response.ok) throw new Error('Tone artifact unavailable');
    const bytes = await response.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (v) =>
      v.toString(16).padStart(2, '0'),
    ).join('');
    if (bytes.byteLength !== TONE_PROFILE.bytes || hash !== TONE_PROFILE.sha256) {
      await cache.delete(TONE_PROFILE.url);
      throw new Error('Tone artifact mismatch');
    }
    await cache.put(
      TONE_PROFILE.url,
      new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }),
    );
    ort.env.wasm.wasmPaths = '/runtime/ort/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    this.session = await ort.InferenceSession.create(bytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    if (
      this.session.inputNames.join(',') !== 'input' ||
      this.session.outputNames.join(',') !== 'signemo_tone_logits'
    ) {
      await this.dispose();
      throw new Error('Tone I/O contract mismatch');
    }
  }
  async infer(
    samples: Float32Array,
    startMs: number,
    endMs: number,
    quality?: SpeechAudioQuality,
  ): Promise<ModalityEvidence> {
    const rejected: ModalityEvidence = {
      source: 'voice',
      startMs,
      endMs,
      scores: {},
      unsupportedScore: 1,
      quality: 'rejected',
      reason: 'insufficient-audio',
      modelVersion: TONE_PROFILE.version,
    };
    if (
      samples.length < 12800 ||
      samples.length > 48000 ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs ||
      samples.some((value) => !Number.isFinite(value) || Math.abs(value) > 1)
    )
      return rejected;
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    if (
      rms < 0.005 ||
      (quality &&
        (quality.speechRms < 0.005 ||
          quality.clippingRatio >= 0.05 ||
          quality.speechRms / Math.max(quality.noiseRms, 0.002) < 1.5))
    )
      return { ...rejected, reason: 'poor-audio' };
    if (!this.session) throw new Error('Tone not ready');
    const tensor = new ort.Tensor('float32', samples, [1, samples.length]);
    let output: ort.InferenceSession.ReturnType | undefined;
    try {
      output = await this.session.run({ input: tensor });
      const logits = output.signemo_tone_logits.data as Float32Array;
      return {
        source: 'voice',
        startMs,
        endMs,
        ...mapEmotionScores(logits, [...TONE_PROFILE.labels]),
        quality: 'usable',
        modelVersion: TONE_PROFILE.version,
      };
    } finally {
      tensor.dispose();
      if (output) Object.values(output).forEach((item) => item.dispose());
    }
  }
  async dispose() {
    const session = this.session;
    this.session = null;
    await session?.release();
  }
}
