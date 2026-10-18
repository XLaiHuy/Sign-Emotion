import { expect, it } from 'vitest';
import { toneAudioUsable } from '../src/domain/toneQuality';
import { fuse, toneFusion, type ModalityEvidence } from '../src/domain/conversation';
const pcm = new Float32Array(48128).fill(0.04);
const quality = { speechRms: 0.04, noiseRms: 0.003, clippingRatio: 0, noiseMeasured: true };
it('accepts the actual VAD hard-cut size but rejects clipping, silence and measured noise', () => {
  expect(toneAudioUsable(pcm, quality)).toBe(true);
  expect(toneAudioUsable(new Float32Array(12800), quality)).toBe(false);
  expect(toneAudioUsable(pcm, { ...quality, clippingRatio: 0.06 })).toBe(false);
  expect(toneAudioUsable(pcm, { ...quality, noiseRms: 0.035 })).toBe(false);
  expect(toneAudioUsable(pcm, { ...quality, noiseRms: 0.035, noiseMeasured: false })).toBe(true);
  expect(toneAudioUsable(new Float32Array(50000), quality)).toBe(false);
});
it('voice can support face without text but cannot override credible disagreement', () => {
  const segment = { id: 'same', startMs: 1000, endMs: 4000 };
  const item = (source: ModalityEvidence['source'], label = 'sad'): ModalityEvidence => ({
    source,
    ...segment,
    segmentId: segment.id,
    scores: { [label]: 0.85 },
    unsupportedScore: 0.15,
    quality: 'usable',
    modelVersion: 'fixture',
  });
  expect(fuse(segment, [item('face'), item('voice')], toneFusion).label).toBe('sad');
  expect(
    fuse(segment, [item('face'), item('voice'), item('text', 'happy')], toneFusion).reason,
  ).toBe('conflict');
  expect(fuse(segment, [item('voice'), item('voice')], toneFusion).label).toBeNull();
  expect(
    fuse(segment, [item('face'), { ...item('voice'), startMs: 5000, endMs: 6000 }], toneFusion)
      .label,
  ).toBeNull();
});
