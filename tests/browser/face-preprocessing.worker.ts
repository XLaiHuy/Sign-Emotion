/// <reference lib="webworker" />
// Synthetic-only harness, built into output/, never shipped in the PWA.
import { faceCrop } from '../../src/domain/face/crop';
import { faceImageStats, applyLowLightGamma } from '../../src/domain/face/lighting';
import { faceImageQuality } from '../../src/domain/face/quality';
import { toEmotiEffInput } from '../../src/infrastructure/inference/emotieff-model';

const source = new OffscreenCanvas(640, 480);
const sourceContext = source.getContext('2d')!;
const seeded = sourceContext.createImageData(640, 480);
for (let i = 0; i < seeded.data.length; i += 4) {
  const n = (((i / 4) * 1664525 + 1013904223) >>> 16) % 80;
  seeded.data.set([n + 10, n + 20, n + 30, 255], i);
}
sourceContext.putImageData(seeded, 0, 0);
const cropCanvas = new OffscreenCanvas(260, 260),
  qualityCanvas = new OffscreenCanvas(64, 64);
const cropContext = cropCanvas.getContext('2d', { willReadFrequently: true })!;
const qualityContext = qualityCanvas.getContext('2d', { willReadFrequently: true })!;
const qualityInput = new Float32Array(4096),
  tensorBuffer = new Float32Array(3 * 260 * 260);
const angle = 0.2;
const points = Array.from({ length: 468 }, (_, i) => {
  const t = (i / 468) * 2 * Math.PI,
    x = 70 * Math.cos(t),
    y = 90 * Math.sin(t);
  return {
    x: (320 + Math.cos(angle) * x - Math.sin(angle) * y) / 640,
    y: (240 + Math.sin(angle) * x + Math.cos(angle) * y) / 480,
  };
});
points[33] = {
  x: (320 - 35 * Math.cos(angle) + 25 * Math.sin(angle)) / 640,
  y: (240 - 35 * Math.sin(angle) - 25 * Math.cos(angle)) / 480,
};
points[263] = {
  x: (320 + 35 * Math.cos(angle) + 25 * Math.sin(angle)) / 640,
  y: (240 + 35 * Math.sin(angle) - 25 * Math.cos(angle)) / 480,
};
const pose = { yaw: 0, pitch: 0, roll: (angle * 180) / Math.PI };

// Frozen pre-change arithmetic, independent of the extracted production helpers.
function oldGeometry() {
  const xs = points.map((p) => p.x * 640),
    ys = points.map((p) => p.y * 480);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const sourceMinX = (minX * source.width) / 640,
    sourceMaxX = (maxX * source.width) / 640;
  const sourceMinY = (minY * source.height) / 480,
    sourceMaxY = (maxY * source.height) / 480;
  return {
    centerX: (sourceMinX + sourceMaxX) / 2,
    centerY: (sourceMinY + sourceMaxY) / 2,
    side: Math.max(sourceMaxX - sourceMinX, sourceMaxY - sourceMinY) * 1.08,
    angle: (pose.roll * Math.PI) / 180,
  };
}
function oldStats(rgba: Uint8ClampedArray) {
  let mean = 0,
    squared = 0;
  for (let i = 0; i < 4096; i++) {
    const v = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    qualityInput[i] = v;
    mean += v;
    squared += v * v;
  }
  mean /= 4096;
  const contrast = Math.sqrt(Math.max(0, squared / 4096 - mean * mean));
  let laplacian = 0,
    laplacianSquared = 0,
    count = 0;
  for (let y = 1; y < 63; y++)
    for (let x = 1; x < 63; x++) {
      const i = y * 64 + x,
        v =
          4 * qualityInput[i] -
          qualityInput[i - 1] -
          qualityInput[i + 1] -
          qualityInput[i - 64] -
          qualityInput[i + 64];
      laplacian += v;
      laplacianSquared += v * v;
      count++;
    }
  return {
    brightness: mean,
    contrast,
    sharpness: laplacianSquared / count - (laplacian / count) ** 2,
  };
}
function preprocess(mode: string) {
  const crop =
    mode === 'original'
      ? oldGeometry()
      : faceCrop(points, pose, source, source, mode === 'eye-crop');
  if (typeof crop === 'string') throw Error(crop);
  for (const [ctx, size] of [
    [cropContext, 260],
    [qualityContext, 64],
  ] as const) {
    ctx.save();
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    ctx.scale(size / crop.side, size / crop.side);
    ctx.rotate(-crop.angle);
    ctx.drawImage(source, -crop.centerX, -crop.centerY);
    ctx.restore();
  }
  const quality = qualityContext.getImageData(0, 0, 64, 64).data;
  const stats = mode === 'original' ? oldStats(quality) : faceImageStats(quality, qualityInput);
  const decision = faceImageQuality(stats.brightness, stats.contrast, stats.sharpness);
  const rgba = cropContext.getImageData(0, 0, 260, 260).data;
  const gamma = mode === 'low-light' && applyLowLightGamma(rgba, stats);
  const tensor = toEmotiEffInput(rgba, 260, 260, tensorBuffer);
  return { rgba, tensor, stats, decision, gamma };
}
self.onmessage = () => {
  try {
    const original = preprocess('original');
    const originalTensor = original.tensor.slice();
    const baseline = preprocess('baseline');
    const parity =
      original.rgba.every((v, i) => v === baseline.rgba[i]) &&
      originalTensor.every((v, i) => v === baseline.tensor[i]) &&
      JSON.stringify(original.stats) === JSON.stringify(baseline.stats) &&
      JSON.stringify(original.decision) === JSON.stringify(baseline.decision);
    if (!parity) throw Error('Baseline parity failed');
    if (!preprocess('low-light').gamma) throw Error('Synthetic fixture did not exercise gamma');
    const modes = ['original', 'baseline', 'eye-crop', 'low-light'];
    const samples: Record<string, number[]> = Object.fromEntries(modes.map((m) => [m, []]));
    for (let round = 0; round < 180; round++)
      for (let offset = 0; offset < modes.length; offset++) {
        const mode = modes[(round + offset) % modes.length];
        const start = performance.now();
        preprocess(mode);
        const ms = performance.now() - start;
        if (round >= 30) samples[mode].push(ms);
      }
    const timings = Object.fromEntries(
      modes.map((mode) => {
        const values = samples[mode].sort((a, b) => a - b);
        return [
          mode,
          {
            samples: values.length,
            p50: values[Math.floor(values.length * 0.5)],
            p95: values[Math.floor(values.length * 0.95)],
          },
        ];
      }),
    );
    const maxIncrease = Math.max(
      ...modes.slice(1).map((m) => timings[m].p95 - timings.original.p95),
    );
    self.postMessage({
      parity,
      timings,
      maxIncrease,
      withinBudget: maxIncrease <= 10,
      fixture:
        'synthetic RGB noise, 640×480, crop260, roll0.2rad; 30 warmup +150 interleaved samples/profile',
    });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
