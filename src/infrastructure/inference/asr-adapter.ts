import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { AsrAdapter, AsrProfileId, AsrRequest } from '../../domain/asr';
import {
  BASELINE_ASR_PROFILE,
  VIETNAMESE_ASR_PROFILE,
  loadSpeechModel,
} from './speech-model-profile';
import { GipformerAdapter } from './gipformer-adapter';
import { MoonshineStreamingAdapter } from './moonshine-adapter';
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/models/local/';
env.useBrowserCache = false;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/runtime/speech/';
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
}
const createAsr = pipeline as unknown as (
  task: 'automatic-speech-recognition',
  name: string,
  options: { device: 'wasm'; dtype: 'q8' },
) => Promise<AutomaticSpeechRecognitionPipeline>;
class WhisperAdapter implements AsrAdapter {
  private model: AutomaticSpeechRecognitionPipeline | null = null;
  private version = '';
  private generation = 0;
  constructor(private profile: Exclude<AsrProfileId, 'gipformer-research'>) {}
  async prepare() {
    const generation = this.generation;
    const create = (profile: typeof VIETNAMESE_ASR_PROFILE) =>
      createAsr('automatic-speech-recognition', profile.id, { device: 'wasm', dtype: 'q8' });
    const profile = this.profile === 'phowhisper' ? VIETNAMESE_ASR_PROFILE : BASELINE_ASR_PROFILE;
    const loaded =
      this.profile === 'product'
        ? await loadSpeechModel(create)
        : { model: await create(profile), profile, usedFallback: false };
    if (generation !== this.generation) {
      await loaded.model.dispose();
      throw new DOMException('Cancelled', 'AbortError');
    }
    this.model = loaded.model;
    this.version = loaded.profile.version;
    return { modelVersion: this.version, fallback: loaded.usedFallback };
  }
  async acceptPcm(request: AsrRequest, _final: boolean) {
    if (!this.model) throw new Error('ASR chưa được chuẩn bị.');
    if (
      !request.samples.length ||
      request.samples.length > 30 * 16000 ||
      request.samples.some((v) => !Number.isFinite(v))
    )
      throw new Error('PCM không hợp lệ.');
    const generation = this.generation,
      start = performance.now();
    const output = await this.model(request.samples, {
      language: 'vietnamese',
      task: 'transcribe',
      max_new_tokens: Math.min(80, Math.max(12, Math.ceil((request.samples.length / 16000) * 14))),
      do_sample: false,
      return_timestamps: false,
    });
    if (generation !== this.generation) throw new DOMException('Cancelled', 'AbortError');
    return {
      id: request.id,
      startMs: request.startMs,
      endMs: request.endMs,
      text: (Array.isArray(output) ? output[0].text : output.text).trim(),
      modelVersion: this.version,
      processingMs: performance.now() - start,
      finalizedAtMs: performance.now(),
      boundary: request.boundary,
      utteranceId: request.utteranceId,
    };
  }
  reset() {
    this.generation++;
  }
  async dispose() {
    this.reset();
    const model = this.model;
    this.model = null;
    await model?.dispose();
  }
}
export function createSpeechAdapter(profile: AsrProfileId = 'product'): AsrAdapter {
  if (profile === 'gipformer-research') return new GipformerAdapter();
  if (profile === 'moonshine-streaming-vi-research') return new MoonshineStreamingAdapter();
  return new WhisperAdapter(profile);
}
