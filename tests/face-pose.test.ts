import { describe, expect, it } from 'vitest';
import { estimateHeadPose, isSupportedHeadPose } from '../src/domain/face/pose';

function rotationMatrix(yaw: number, pitch: number, roll: number) {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  const r = (roll * Math.PI) / 180;
  const cy = Math.cos(y),
    sy = Math.sin(y),
    cp = Math.cos(p),
    sp = Math.sin(p),
    cr = Math.cos(r),
    sr = Math.sin(r);
  // Rz(roll) * Ry(yaw) * Rx(pitch), flattened column-major.
  const values = [
    cr * cy,
    sr * cy,
    -sy,
    0,
    cr * sy * sp - sr * cp,
    sr * sy * sp + cr * cp,
    cy * sp,
    0,
    cr * sy * cp + sr * sp,
    sr * sy * cp - cr * sp,
    cy * cp,
    0,
    0,
    0,
    0,
    1,
  ];
  return { rows: 4, columns: 4, data: values };
}

describe('MediaPipe head pose estimate', () => {
  it('extracts yaw, pitch, roll from the canonical transform', () => {
    const pose = estimateHeadPose(rotationMatrix(18, -12, 20));
    expect(pose?.yaw).toBeCloseTo(18, 2);
    expect(pose?.pitch).toBeCloseTo(-12, 2);
    expect(pose?.roll).toBeCloseTo(20, 2);
  });

  it('abstains for malformed transforms and applies the initial supported range', () => {
    expect(estimateHeadPose(undefined)).toBeNull();
    expect(estimateHeadPose({ rows: 4, columns: 4, data: [] })).toBeNull();
    expect(isSupportedHeadPose({ yaw: 30, pitch: 20, roll: 25 })).toBe(true);
    expect(isSupportedHeadPose({ yaw: 0, pitch: 28, roll: 0 })).toBe(true);
    expect(isSupportedHeadPose({ yaw: 0, pitch: 29, roll: 0 })).toBe(false);
    expect(isSupportedHeadPose({ yaw: 31, pitch: 0, roll: 0 })).toBe(false);
  });
});
