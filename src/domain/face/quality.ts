import type { QualityReason } from '../../shared/contracts';

/** Experimental bands, not calibrated accuracy. Geometry failures remain hard rejections. */
export function faceImageQuality(
  mean: number,
  contrast: number,
  sharpness: number,
): {
  rejected?: QualityReason;
  warning?: 'blurred';
} {
  if (![mean, contrast, sharpness].every(Number.isFinite)) return { rejected: 'blurred' };
  if (mean < 35) return { rejected: 'too-dark' };
  if (mean > 235) return { rejected: 'too-bright' };
  if (contrast < 14) return { rejected: 'low-contrast' };
  if (sharpness < 3) return { rejected: 'blurred' };
  return sharpness < 10 ? { warning: 'blurred' } : {};
}
