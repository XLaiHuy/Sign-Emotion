import { describe, expect, it } from 'vitest';
import { mapAudioSampleToMediaMs } from '../src/domain/videoSync';

describe('video media clock mapping', () => {
  it("maps 16 kHz audio sample offsets to the local video's timeline", () => {
    expect(mapAudioSampleToMediaMs(16_000, 0, 2_500)).toBe(3_500);
    expect(mapAudioSampleToMediaMs(24_000, 8_000, 4_000)).toBe(5_000);
  });

  it('reanchors cleanly after a seek and clamps negative media time', () => {
    expect(mapAudioSampleToMediaMs(1_600, 1_600, 8_000)).toBe(8_000);
    expect(mapAudioSampleToMediaMs(0, 16_000, 500)).toBe(0);
  });

  it('rejects invalid offsets and sample rates rather than creating corrupt timestamps', () => {
    expect(mapAudioSampleToMediaMs(Number.NaN, 0, 0)).toBeNull();
    expect(mapAudioSampleToMediaMs(100, 0, 0, 0)).toBeNull();
  });
});
