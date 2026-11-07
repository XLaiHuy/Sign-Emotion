import type { QualityReason } from '../../shared/contracts';
import { isSupportedHeadPose, type HeadPose } from './pose';

type Point = { x: number; y: number };
export type FaceCrop = { centerX: number; centerY: number; side: number; angle: number };
/** Geometry only. No image, landmark or crop data is persisted. */
export function faceCrop(
  points: readonly Point[],
  pose: HeadPose | null,
  detection: { width: number; height: number },
  source: { width: number; height: number },
  eyeAligned = false,
): FaceCrop | QualityReason {
  const xs = points.map((p) => p.x * detection.width);
  const ys = points.map((p) => p.y * detection.height);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  if (maxX - minX < 90 || maxY - minY < 90) return 'face-too-small';
  if (minX < 0 || minY < 0 || maxX > detection.width || maxY > detection.height)
    return 'face-outside';
  if (!pose || !isSupportedHeadPose(pose)) return 'face-angle';
  // Keep the original arithmetic and axis-aligned bounds for baseline parity.
  const sourceMinX = (minX * source.width) / detection.width;
  const sourceMaxX = (maxX * source.width) / detection.width;
  const sourceMinY = (minY * source.height) / detection.height;
  const sourceMaxY = (maxY * source.height) / detection.height;
  if (!eyeAligned)
    return {
      centerX: (sourceMinX + sourceMaxX) / 2,
      centerY: (sourceMinY + sourceMaxY) / 2,
      side: Math.max(sourceMaxX - sourceMinX, sourceMaxY - sourceMinY) * 1.08,
      angle: (pose.roll * Math.PI) / 180,
    };
  if (
    !points[33] ||
    !points[263] ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return 'face-angle';
  const dx = (points[263].x - points[33].x) * source.width;
  const dy = (points[263].y - points[33].y) * source.height;
  if (Math.hypot(dx, dy) < 1) return 'face-angle';
  let angle = Math.atan2(dy, dx);
  // A mirrored source reverses eye ordering, but must never turn the crop upside down.
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  let loX = Infinity,
    hiX = -Infinity,
    loY = Infinity,
    hiY = -Infinity;
  for (const p of points) {
    const x = p.x * source.width,
      y = p.y * source.height;
    const u = c * x + s * y,
      v = -s * x + c * y;
    loX = Math.min(loX, u);
    hiX = Math.max(hiX, u);
    loY = Math.min(loY, v);
    hiY = Math.max(hiY, v);
  }
  const u = (loX + hiX) / 2,
    v = (loY + hiY) / 2;
  const crop = {
    centerX: c * u - s * v,
    centerY: s * u + c * v,
    side: Math.max(hiX - loX, hiY - loY) * 1.08,
    angle,
  };
  // Experimental crops do not invent missing border pixels.
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      const x = crop.centerX + ((c * a - s * b) * crop.side) / 2;
      const y = crop.centerY + ((s * a + c * b) * crop.side) / 2;
      if (x < 0 || y < 0 || x > source.width || y > source.height) return 'face-outside';
    }
  return crop;
}
