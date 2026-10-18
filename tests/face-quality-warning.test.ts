import { expect, it } from 'vitest';
import { faceImageQuality } from '../src/domain/face/quality';
import { fuse, type ModalityEvidence, type TranscriptSegment } from '../src/domain/conversation';
import { FaceWindow } from '../src/domain/faceWindow';
import { emptyResult } from '../src/domain/face/prediction';

const segment: TranscriptSegment = {
  id: 's',
  startMs: 0,
  endMs: 1000,
  text: '',
  modelVersion: 'test',
  processingMs: 0,
  finalizedAtMs: 1100,
};
const face: ModalityEvidence = {
  source: 'face',
  startMs: 0,
  endMs: 1000,
  scores: { sad: 0.6, angry: 0.4 },
  unsupportedScore: 0,
  quality: 'usable',
  modelVersion: 'test',
  reliability: 'reduced',
};
const text: ModalityEvidence = {
  ...face,
  source: 'text',
  reliability: undefined,
  scores: { sad: 0.9, angry: 0.1 },
};

it('keeps geometry/severe blur, darkness and contrast failures out while distinguishing mild blur', () => {
  expect(faceImageQuality(120, 20, 2)).toEqual({ rejected: 'blurred' });
  expect(faceImageQuality(120, 20, 5)).toEqual({ warning: 'blurred' });
  expect(faceImageQuality(120, 20, 10)).toEqual({});
  expect(faceImageQuality(20, 20, 30).rejected).toBe('too-dark');
  expect(faceImageQuality(240, 20, 30).rejected).toBe('too-bright');
  expect(faceImageQuality(120, 10, 30).rejected).toBe('low-contrast');
  expect(faceImageQuality(NaN, 20, 30).rejected).toBeDefined();
});
it('requires 0.25 margin for reduced face quality and does not fabricate another vote', () => {
  expect(fuse(segment, [face, text]).label).toBeNull();
  expect(fuse(segment, [{ ...face, scores: { sad: 0.7, angry: 0.3 } }]).label).toBeNull();
  const strong = { ...face, scores: { sad: 0.7, angry: 0.3 } };
  expect(fuse(segment, [strong, text]).score).toBeCloseTo((0.7 * 0.3 + 0.9) / 1.3);
  expect(fuse(segment, [strong, { ...text, scores: { angry: 0.9 } }]).reason).toBe('conflict');
  expect(fuse(segment, [{ ...strong, quality: 'rejected' }, text]).label).toBeNull();
});
it('marks the complete face interval reduced if any included observation is warned; never includes rejected/held frames', () => {
  const window = new FaceWindow();
  for (const timestamp of [0, 500, 1000])
    window.add({
      ...emptyResult(),
      timestamp,
      status: 'valid',
      observationUsable: true,
      scores: [0.1, 0.02, 0.02, 0.8, 0.02, 0.02, 0.01, 0.01],
      qualityWarning: timestamp === 500 ? 'blurred' : undefined,
    });
  expect(window.evidence(segment)?.reliability).toBe('reduced');
  window.reset(1100);
  for (const timestamp of [1200, 1700, 2200])
    window.add({
      ...emptyResult(),
      timestamp,
      status: 'poor-quality',
      qualityReason: 'blurred',
      scores: [],
    });
  expect(window.evidence({ ...segment, startMs: 1200, endMs: 2200 })).toBeNull();
});
