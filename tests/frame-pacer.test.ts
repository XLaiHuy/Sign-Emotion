import { expect, it } from 'vitest';
import { FramePacer, RecentFaceTiming } from '../src/domain/face/framePacer';
import { AsrWorkload } from '../src/domain/asr';
import { toEmotiEffInput } from '../src/infrastructure/inference/emotieff-model';
it('keeps 5 Hz with sub-millisecond callback jitter instead of slipping to every third source frame', () => {
  const pacer = new FramePacer();
  let count = 0;
  for (let i = 0; i < 1200; i++) if (pacer.take(i * 100 + Math.sin(i), i / 10, false, 200)) count++;
  expect(count).toBe(600);
});
it('paces fresh frames without adding inference time to the interval or catching up old deadlines', () => {
  const p = new FramePacer();
  expect(p.take(0, 0, false, 200)).toBe(true);
  expect(p.take(150, 0.15, false, 200)).toBe(false);
  expect(p.take(200, 0.2, false, 200)).toBe(true);
  expect(p.take(400, 0.4, true, 200)).toBe(false);
  expect(p.take(900, 0.9, false, 200)).toBe(true);
  expect(p.missedDeadlines).toBe(2);
  expect(p.take(901, 0.901, false, 200)).toBe(false);
  expect(p.take(1200, 0.9, false, 200)).toBe(false);
  expect(p.take(1201, 0, false, 200)).toBe(true);
});
it('forgets old face pressure and counts overlapping ASR partial work once per audio interval', () => {
  const face = new RecentFaceTiming();
  face.add(0, 1000);
  face.add(6000, 50);
  expect(face.mean(6000)).toBe(50);
  const speech = new AsrWorkload();
  speech.observe({ startMs: 0, endMs: 1000 }, 800, 0);
  speech.observe({ startMs: 0, endMs: 2000 }, 800, 1000);
  expect(speech.recentRtf(1000)).toBe(0.8);
  speech.observe({ startMs: 12000, endMs: 13000 }, 100, 13000);
  expect(speech.recentRtf(13000)).toBe(0.1);
  expect(speech.rtf).toBeGreaterThan(speech.recentRtf(13000));
  expect(speech.snapshot([{ queuedAtMs: 12000 }], 13000)).toEqual({
    pendingAsr: 1,
    rtf: 0.1,
    oldestFinalWaitMs: 1000,
  });
  expect(speech.canRunContext(0, 24000)).toBe(true);
});
it('reuses RGB storage without changing asymmetric channel normalization', () => {
  const rgba = [255, 0, 64, 255, 0, 128, 255, 255];
  const scratch = new Float32Array(6);
  expect(toEmotiEffInput(rgba, 2, 1, scratch)).toBe(scratch);
  expect([...scratch]).toEqual([...toEmotiEffInput(rgba, 2, 1)]);
  expect(() => toEmotiEffInput(rgba, 2, 1, new Float32Array(5))).toThrow();
});
