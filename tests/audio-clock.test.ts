import { expect, it } from 'vitest';
import { audioFrameStartMs, audioFrameGapMs } from '../src/domain/audioClock';

it('distinguishes an uninterrupted PCM clock from output timestamp jitter and real missing audio', () => {
  expect(audioFrameGapMs(1000.032, 1000, 512)).toBeCloseTo(0, 5);
  expect(audioFrameGapMs(1000.736, 1000, 512)).toBeCloseTo(704, 5);
  expect(audioFrameGapMs(2, undefined, 512)).toBe(0);
  expect(audioFrameGapMs(1, 2, 512)).toBe(Infinity);
  expect(audioFrameGapMs(NaN, 2, 512)).toBe(Infinity);
});

it('maps audio time through a fresh clock pair even after 30 minutes of drift and delayed delivery', () => {
  for (const elapsedMs of [1000, 60_000, 1800_000]) {
    const contextEndSeconds = elapsedMs / 1000;
    const driftMs = elapsedMs * 0.001;
    const actualEndMs = 100 + elapsedMs + driftMs;
    const outputStamp = {
      contextTime: contextEndSeconds + 0.12,
      performanceTime: actualEndMs + 120,
    };
    expect(audioFrameStartMs(contextEndSeconds, outputStamp, 512)).toBeCloseTo(actualEndMs - 32, 5);
    // Mapping uses the audio frame time, not the much later main-thread callback time.
    expect(
      audioFrameStartMs(
        contextEndSeconds,
        { contextTime: contextEndSeconds + 2, performanceTime: actualEndMs + 2000 },
        512,
      ),
    ).toBeCloseTo(actualEndMs - 32, 5);
  }
});
it('rejects missing, non-finite and not-yet-rendered timestamps rather than fabricating time zero', () => {
  expect(audioFrameStartMs(NaN, { contextTime: 1, performanceTime: 1000 }, 512)).toBeUndefined();
  expect(audioFrameStartMs(1, {}, 512)).toBeUndefined();
  expect(audioFrameStartMs(1, { contextTime: 0, performanceTime: 0 }, 512)).toBeUndefined();
  expect(audioFrameStartMs(1, { contextTime: 1, performanceTime: 1000 }, 0)).toBeUndefined();
});
