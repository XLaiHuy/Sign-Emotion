export interface PoseMatrix {
  rows: number;
  columns: number;
  data: ArrayLike<number>;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * Decompose MediaPipe's column-major 4x4 canonical-face transform.
 * Angles are estimates for input-quality gating, not a medical measurement.
 */
export function estimateHeadPose(matrix: PoseMatrix | undefined): HeadPose | null {
  if (
    !matrix ||
    matrix.rows !== 4 ||
    matrix.columns !== 4 ||
    matrix.data.length !== 16 ||
    Array.from(matrix.data).some((value) => !Number.isFinite(value))
  )
    return null;

  const data = matrix.data;
  const sx = Math.hypot(data[0], data[1], data[2]);
  const sy = Math.hypot(data[4], data[5], data[6]);
  const sz = Math.hypot(data[8], data[9], data[10]);
  if (Math.min(sx, sy, sz) < 1e-6) return null;

  // Rotation entries after removing the uniform scale. MediaPipe matrices are
  // flattened column-major: indices 0..2, 4..6 and 8..10 are basis columns.
  const r00 = data[0] / sx;
  const r10 = data[1] / sx;
  const r20 = data[2] / sx;
  const r21 = data[6] / sy;
  const r22 = data[10] / sz;
  const toDegrees = 180 / Math.PI;
  return {
    yaw: Math.asin(Math.max(-1, Math.min(1, -r20))) * toDegrees,
    pitch: Math.atan2(r21, r22) * toDegrees,
    roll: Math.atan2(r10, r00) * toDegrees,
  };
}

export function isSupportedHeadPose(pose: HeadPose): boolean {
  return Math.abs(pose.yaw) <= 30 && Math.abs(pose.pitch) <= 28 && Math.abs(pose.roll) <= 25;
}
