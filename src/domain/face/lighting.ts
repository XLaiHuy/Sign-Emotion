import { faceImageQuality } from './quality';
export interface FaceImageStats {
  brightness: number;
  contrast: number;
  sharpness: number;
}
/** Preserve the baseline's 64x64 luminance and Laplacian arithmetic. */
export function faceImageStats(rgba: ArrayLike<number>, input: Float32Array): FaceImageStats {
  if (input.length !== 4096 || rgba.length !== 4096 * 4) throw new Error('Invalid quality buffer');
  let mean = 0,
    squared = 0;
  for (let i = 0; i < input.length; i++) {
    const v = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    input[i] = v;
    mean += v;
    squared += v * v;
  }
  mean /= input.length;
  const contrast = Math.sqrt(Math.max(0, squared / input.length - mean * mean));
  let laplacian = 0,
    laplacianSquared = 0,
    count = 0;
  for (let y = 1; y < 63; y++)
    for (let x = 1; x < 63; x++) {
      const i = y * 64 + x;
      const value = 4 * input[i] - input[i - 1] - input[i + 1] - input[i - 64] - input[i + 64];
      laplacian += value;
      laplacianSquared += value * value;
      count++;
    }
  return {
    brightness: mean,
    contrast,
    sharpness: laplacianSquared / count - (laplacian / count) ** 2,
  };
}
const gamma085 = Uint8ClampedArray.from({ length: 256 }, (_, value) => 255 * (value / 255) ** 0.85);
/** Mutate the worker-owned crop buffer only; alpha and original preview stay intact. */
export function applyLowLightGamma(rgba: Uint8ClampedArray, stats: FaceImageStats) {
  if (
    stats.brightness < 35 ||
    stats.brightness > 80 ||
    faceImageQuality(stats.brightness, stats.contrast, stats.sharpness).rejected
  )
    return false;
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = gamma085[rgba[i]];
    rgba[i + 1] = gamma085[rgba[i + 1]];
    rgba[i + 2] = gamma085[rgba[i + 2]];
  }
  return true;
}
