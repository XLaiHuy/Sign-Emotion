import type { AsrProfileId } from '../../domain/asr';
import type { FaceModelProfile } from './face-model-profile';

/** Build-time opt-in; never promote a research model through persisted settings. */
export function conversationProfile(
  value = import.meta.env.VITE_AI_PROFILE,
  streaming = import.meta.env.VITE_STREAMING_ASR,
): {
  id: 'baseline' | 'pc-candidate';
  asr: AsrProfileId;
  face: FaceModelProfile;
} {
  return value === 'pc-candidate'
    ? {
        id: 'pc-candidate',
        asr: streaming === 'moonshine' ? 'moonshine-streaming-vi-research' : 'gipformer-research',
        face: 'b0-webgpu-research',
      }
    : { id: 'baseline', asr: 'product', face: 'product' };
}

/** B0 candidate has no B2 fallback; baseline retains its own pinned checkpoint. */
export function selectedCoreAssets<T extends { url: string }>(
  assets: T[],
  profile = conversationProfile().id,
): T[] {
  return profile === 'pc-candidate'
    ? assets.filter((asset) => asset.url !== '/models/enet_b2_8.onnx')
    : assets;
}

/** Candidate prepares its own ASR; avoid downloading dormant Whisper checkpoints/runtime. */
export function selectedSpeechAssets<T extends { url: string }>(
  assets: T[],
  profile = conversationProfile().id,
): T[] {
  return profile === 'pc-candidate'
    ? assets.filter((asset) => asset.url === '/models/local/silero_vad.onnx')
    : assets;
}
