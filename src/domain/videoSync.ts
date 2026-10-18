/** Map 16 kHz VAD sample offsets onto the local video's media clock. */
export function mapAudioSampleToMediaMs(
  sample: number,
  anchorSample: number,
  anchorMediaMs: number,
  sampleRate = 16_000,
) {
  if (
    !Number.isFinite(sample) ||
    !Number.isFinite(anchorSample) ||
    !Number.isFinite(anchorMediaMs) ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0
  )
    return null;
  return Math.max(0, anchorMediaMs + ((sample - anchorSample) * 1000) / sampleRate);
}
