import { describe, expect, it } from 'vitest';
import { elapsedMs, frameLatencyMs } from '../src/domain/face/frameTiming';

describe('face frame timing', () => {
  it('measures capture duration from the timestamp taken before bitmap capture', () => {
    expect(elapsedMs(100, 145)).toBe(45);
  });

  it('reports end-to-end latency including capture, inference, and delivery', () => {
    expect(frameLatencyMs(100, 45, 80, 236)).toBe(136);
  });

  it('keeps the measured component sum when timer delivery is unusually early', () => {
    expect(frameLatencyMs(100, 45, 80, 200)).toBe(125);
  });
});
