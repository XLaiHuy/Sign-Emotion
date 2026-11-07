import { describe, expect, it } from 'vitest';
import { faceExperimentConfig, faceExperiments } from '../src/domain/face/experiments';
import { faceCrop } from '../src/domain/face/crop';
import { applyLowLightGamma, faceImageStats } from '../src/domain/face/lighting';
import { faceImageQuality } from '../src/domain/face/quality';
import { defaultSettings } from '../src/shared/contracts';
import { emptyResult, PredictionGate } from '../src/domain/face/prediction';
import { ObservationCounts } from '../src/domain/face/observation';

const size = { width: 640, height: 480 };
const pose = { yaw: 0, pitch: 0, roll: 0 };
function landmarks(angle = 0, mirror = false, cx = 320) {
  const points = Array.from({ length: 468 }, (_, i) => {
    const t = (i / 468) * Math.PI * 2;
    return { x: 70 * Math.cos(t), y: 90 * Math.sin(t) };
  });
  points[33] = { x: -35, y: -25 };
  points[263] = { x: 35, y: -25 };
  return points.map((p) => {
    const x = p.x * Math.cos(angle) - p.y * Math.sin(angle);
    const y = p.x * Math.sin(angle) + p.y * Math.cos(angle);
    return { x: (cx + (mirror ? -x : x)) / 640, y: (240 + y) / 480 };
  });
}
describe('local, independent face experiments', () => {
  it('leaves public defaults intact and rejects malformed/non-local experiments', () => {
    expect(faceExperimentConfig(undefined, false, 'sign-emotion.vercel.app')).toMatchObject({
      id: 'baseline',
      detectionConfidence: 0.6,
      expressionThreshold: 0.55,
      preprocessingVersion: 'roll-crop-v1',
    });
    for (const id of faceExperiments.slice(1)) {
      expect(() => faceExperimentConfig(id, true, 'sign-emotion.vercel.app')).toThrow();
      expect(() => faceExperimentConfig(id, false, 'localhost')).toThrow();
      expect(() => faceExperimentConfig(id, true, 'localhost.evil.test')).toThrow();
    }
    expect(() => faceExperimentConfig('other', true, 'localhost')).toThrow();
    expect(faceExperimentConfig('detector-050', true, '127.0.0.1')).toMatchObject({
      detectionConfidence: 0.5,
      expressionThreshold: 0.55,
      preprocessingVersion: 'roll-crop-v1',
    });
    expect(faceExperimentConfig('expression-050', true, '[::1]')).toMatchObject({
      detectionConfidence: 0.6,
      expressionThreshold: 0.5,
      preprocessingVersion: 'roll-crop-v1',
    });
  });
  it('preserves original baseline crop arithmetic exactly across rotation and mirroring', () => {
    for (const angle of [0, -0.35, 0.35])
      for (const mirror of [false, true]) {
        const points = landmarks(angle, mirror);
        const xs = points.map((p) => p.x * 640),
          ys = points.map((p) => p.y * 480);
        const x0 = Math.min(...xs),
          x1 = Math.max(...xs),
          y0 = Math.min(...ys),
          y1 = Math.max(...ys);
        expect(faceCrop(points, { ...pose, roll: (angle * 180) / Math.PI }, size, size)).toEqual({
          centerX: (x0 + x1) / 2,
          centerY: (y0 + y1) / 2,
          side: Math.max(x1 - x0, y1 - y0) * 1.08,
          angle,
        });
      }
  });
  it('bounds rotated landmarks in eye coordinates, handles mirrors and rejects edges/unsupported pose', () => {
    for (const angle of [0, -0.35, 0.35])
      for (const mirror of [false, true]) {
        const crop = faceCrop(landmarks(angle, mirror), pose, size, size, true);
        expect(typeof crop).toBe('object');
        if (typeof crop === 'string') throw Error(crop);
        expect(crop.centerX).toBeCloseTo(320);
        expect(crop.centerY).toBeCloseTo(240);
        expect(crop.side).toBeCloseTo(180 * 1.08);
        expect(crop.angle).toBeCloseTo(mirror ? -angle : angle);
      }
    expect(faceCrop(landmarks(0, false, 75), pose, size, size, true)).toBe('face-outside');
    for (const bad of [
      { ...pose, yaw: 31 },
      { ...pose, pitch: 29 },
      { ...pose, roll: 26 },
    ])
      expect(faceCrop(landmarks(), bad, size, size, true)).toBe('face-angle');
    expect(
      faceCrop(
        landmarks().map((p) => ({ ...p, x: p.x + 1 })),
        pose,
        size,
        size,
        true,
      ),
    ).toBe('face-outside');
  });
});

describe('raw quality and opt-in lighting', () => {
  it('keeps quality decisions independent of compensation and never changes rejected/bright pixels', () => {
    for (const stats of [
      { brightness: 20, contrast: 30, sharpness: 30 },
      { brightness: 240, contrast: 30, sharpness: 30 },
      { brightness: 60, contrast: 5, sharpness: 30 },
      { brightness: 60, contrast: 30, sharpness: 2 },
      { brightness: 120, contrast: 30, sharpness: 30 },
    ]) {
      const rgba = new Uint8ClampedArray([40, 60, 80, 123]);
      const original = rgba.slice();
      expect(applyLowLightGamma(rgba, stats)).toBe(false);
      expect(rgba).toEqual(original);
    }
    for (const brightness of [35, 60, 80]) {
      const rgba = new Uint8ClampedArray([40, 60, 80, 123]);
      expect(applyLowLightGamma(rgba, { brightness, contrast: 30, sharpness: 30 })).toBe(true);
      expect(Array.from(rgba)).toEqual(
        [40, 60, 80].map((v) => new Uint8ClampedArray([255 * (v / 255) ** 0.85])[0]).concat(123),
      );
    }
  });
  it('computes contrast/brightness and rejects uniform or blurred fixtures before gamma', () => {
    for (const brightness of [20, 60, 120, 245]) {
      const rgba = new Uint8ClampedArray(64 * 64 * 4).fill(brightness);
      const stats = faceImageStats(rgba, new Float32Array(4096));
      expect(stats.brightness).toBeCloseTo(brightness);
      expect(stats.contrast).toBeCloseTo(0, 4);
      expect(stats.sharpness).toBe(0);
      expect(
        faceImageQuality(stats.brightness, stats.contrast, stats.sharpness).rejected,
      ).toBeDefined();
      expect(applyLowLightGamma(rgba, stats)).toBe(false);
    }
  });
});

it('counts duplicate-free RAM reasons and never emits haptic events for rejected frames', () => {
  const gate = new PredictionGate(defaultSettings),
    counts = new ObservationCounts();
  for (const status of ['no-face', 'multiple-faces', 'poor-quality'] as const) {
    for (let timestamp = 0; timestamp < 2000; timestamp += 200) {
      const result = {
        ...emptyResult(),
        timestamp,
        status,
        qualityReason: status === 'poor-quality' ? ('face-angle' as const) : undefined,
        imageDiagnostics: {
          inputSize: 260,
          preprocessingVersion: 'roll-crop-v1',
          experiment: 'baseline' as const,
          gammaApplied: false,
        },
      };
      counts.add(result);
      counts.add(result);
      const decision = gate.update(result);
      expect(decision.result.label).toBeNull();
      expect(decision.trigger).toBeNull();
    }
  }
  expect(counts.total).toBe(30);
  expect(counts.reasons).toEqual({ 'no-face': 10, 'multiple-faces': 10, 'face-angle': 10 });
});
