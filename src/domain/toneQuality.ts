import type { SpeechAudioQuality } from './audio';

/** Conservative eligibility, not an emotion classifier or denoiser. */
export function toneAudioUsable(samples: Float32Array, quality: SpeechAudioQuality) {
  if (
    samples.length < 12800 ||
    samples.length > 49152 ||
    samples.some((v) => !Number.isFinite(v) || Math.abs(v) > 1) ||
    !Number.isFinite(quality.speechRms) ||
    !Number.isFinite(quality.clippingRatio) ||
    quality.speechRms < 0.005 ||
    quality.clippingRatio >= 0.05
  )
    return false;
  const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
  return (
    rms >= 0.005 &&
    (!quality.noiseMeasured ||
      (Number.isFinite(quality.noiseRms) &&
        quality.noiseRms >= 0 &&
        quality.speechRms / Math.max(quality.noiseRms, 0.002) >= 1.5))
  );
}
