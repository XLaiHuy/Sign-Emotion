/** Fixed, versioned spectral/prosody features. Not emotion probabilities. */
export const PROSODY_VERSION = 'mel16-prosody-v1';
export const PROSODY_FEATURES = [
  ...Array.from({ length: 16 }, (_, i) => `mel_mean_${i}`),
  ...Array.from({ length: 16 }, (_, i) => `mel_std_${i}`),
  'log_f0_std',
  'log_f0_change',
  'voiced_ratio',
  'log_rms_mean',
  'log_rms_std',
  'quiet_ratio',
  'log_duration',
];
export interface ProsodySummary {
  version: string;
  features: number[];
  frames: number;
  durationMs: number;
}
const mel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const hz = (value: number) => 700 * (10 ** (value / 2595) - 1);
const bands = Array.from({ length: 18 }, (_, i) =>
  Math.floor((513 * hz((mel(7600) * i) / 17)) / 16000),
);
function spectrum(frame: Float32Array) {
  const real = new Float64Array(512),
    imaginary = new Float64Array(512);
  for (let i = 0; i < 512; i++)
    real[i] = frame[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 511));
  for (let i = 1, j = 0; i < 512; i++) {
    let bit = 256;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let size = 2; size <= 512; size *= 2) {
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < 512; start += size) {
      for (let j = 0; j < size / 2; j++) {
        const index = start + j,
          other = index + size / 2;
        const c = Math.cos(angle * j),
          s = Math.sin(angle * j);
        const re = real[other] * c - imaginary[other] * s;
        const im = real[other] * s + imaginary[other] * c;
        real[other] = real[index] - re;
        imaginary[other] = imaginary[index] - im;
        real[index] += re;
        imaginary[index] += im;
      }
    }
  }
  return Array.from({ length: 16 }, (_, band) => {
    let energy = 0,
      weight = 0;
    for (let bin = bands[band]; bin <= bands[band + 2]; bin++) {
      const w =
        bin < bands[band + 1]
          ? (bin - bands[band]) / Math.max(1, bands[band + 1] - bands[band])
          : (bands[band + 2] - bin) / Math.max(1, bands[band + 2] - bands[band + 1]);
      energy += (w * (real[bin] ** 2 + imaginary[bin] ** 2)) / 512 ** 2;
      weight += w;
    }
    return Math.log(Math.max(1e-12, energy / Math.max(1, weight)));
  });
}
function pitch(history: Float32Array) {
  const values = new Float64Array(256);
  for (let i = 0; i < 256; i++)
    values[i] = (history[i * 4] + history[i * 4 + 1] + history[i * 4 + 2] + history[i * 4 + 3]) / 4;
  const mean = values.reduce((sum, value) => sum + value, 0) / 256;
  for (let i = 0; i < 256; i++) values[i] -= mean;
  const correlation = new Float64Array(68);
  let best = 0;
  for (let lag = 8; lag <= 66; lag++) {
    let cross = 0,
      a = 0,
      b = 0;
    for (let i = lag; i < 256; i++) {
      cross += values[i] * values[i - lag];
      a += values[i] ** 2;
      b += values[i - lag] ** 2;
    }
    correlation[lag] = cross / Math.max(1e-12, Math.sqrt(a * b));
    best = Math.max(best, correlation[lag]);
  }
  if (best < 0.65) return null;
  for (let lag = 9; lag < 66; lag++)
    if (
      correlation[lag] >= best * 0.9 &&
      correlation[lag] > correlation[lag - 1] &&
      correlation[lag] >= correlation[lag + 1]
    )
      return Math.log(4000 / lag);
  return null;
}
export class ProsodyAccumulator {
  private count = 0;
  private sums = new Float64Array(16);
  private squares = new Float64Array(16);
  private voiced = 0;
  private pitchSum = 0;
  private pitchSquares = 0;
  private pitchChange = 0;
  private changes = 0;
  private previousPitch: number | null = null;
  private energySum = 0;
  private energySquares = 0;
  private quiet = 0;
  private history = new Float32Array(1024);
  push(frame: Float32Array) {
    if (frame.length !== 512 || frame.some((value) => !Number.isFinite(value)))
      throw new Error('Prosody requires finite PCM16k frames of 512 samples');
    const values = spectrum(frame);
    values.forEach((value, i) => {
      this.sums[i] += value;
      this.squares[i] += value ** 2;
    });
    const rms = Math.sqrt(frame.reduce((sum, value) => sum + value * value, 0) / 512);
    const energy = Math.log(Math.max(rms, 1e-6));
    this.energySum += energy;
    this.energySquares += energy ** 2;
    if (rms < 0.005) this.quiet++;
    this.history.copyWithin(0, 512);
    this.history.set(frame, 512);
    const value = rms >= 0.005 && this.count > 0 ? pitch(this.history) : null;
    if (value !== null) {
      this.voiced++;
      this.pitchSum += value;
      this.pitchSquares += value ** 2;
      if (this.previousPitch !== null) {
        this.pitchChange += Math.abs(value - this.previousPitch);
        this.changes++;
      }
    }
    this.previousPitch = value;
    this.count++;
  }
  summary(): ProsodySummary {
    const count = Math.max(1, this.count),
      voiced = Math.max(1, this.voiced);
    const std = (sum: number, square: number, n: number) =>
      Math.sqrt(Math.max(0, square / n - (sum / n) ** 2));
    return {
      version: PROSODY_VERSION,
      frames: this.count,
      durationMs: this.count * 32,
      features: [
        ...Array.from(this.sums, (sum) => sum / count),
        ...Array.from(this.sums, (sum, i) => std(sum, this.squares[i], count)),
        std(this.pitchSum, this.pitchSquares, voiced),
        this.pitchChange / Math.max(1, this.changes),
        this.voiced / count,
        this.energySum / count,
        std(this.energySum, this.energySquares, count),
        this.quiet / count,
        Math.log(Math.max(0.032, this.count * 0.032)),
      ],
    };
  }
}
/** Same implementation is imported by the offline extraction CLI for parity. */
export function extractProsody(samples: Float32Array): ProsodySummary {
  const accumulator = new ProsodyAccumulator();
  for (let start = 0; start + 512 <= samples.length; start += 512)
    accumulator.push(samples.subarray(start, start + 512));
  return accumulator.summary();
}
