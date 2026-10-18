import { ProsodyAccumulator, type ProsodySummary } from './prosody';
const PHASES = 2048;
/** Cached polyphase windowed-sinc coefficients; no trigonometry in capture blocks. */
export class StreamingResampler {
  private buffer = new Float32Array(16384);
  private head = 0;
  private length = 16;
  private position = 16;
  private readonly step: number;
  private readonly coefficients: Float64Array;
  constructor(
    private inputRate: number,
    private outputRate = 16000,
  ) {
    if (
      !Number.isFinite(inputRate) ||
      !Number.isFinite(outputRate) ||
      outputRate <= 0 ||
      inputRate < outputRate
    )
      throw new Error('Unsupported input sample rate');
    this.step = inputRate / outputRate;
    this.coefficients = new Float64Array((PHASES + 1) * 32);
    if (inputRate === outputRate) return;
    const cutoff = (outputRate / inputRate) * 0.9;
    for (let phase = 0; phase <= PHASES; phase++) {
      let total = 0;
      for (let tap = 0; tap < 32; tap++) {
        const delta = tap - 15 - phase / PHASES;
        const x = Math.PI * cutoff * delta;
        const sinc = Math.abs(x) < 1e-8 ? 1 : Math.sin(x) / x;
        const weight = cutoff * sinc * (0.5 + 0.5 * Math.cos((Math.PI * delta) / 16));
        this.coefficients[phase * 32 + tap] = weight;
        total += weight;
      }
      for (let tap = 0; tap < 32; tap++) this.coefficients[phase * 32 + tap] /= total;
    }
  }
  push(input: Float32Array): Float32Array {
    const output = new Float32Array(this.outputCapacity(input.length));
    const written = this.pushInto(input, output);
    return written === output.length ? output : output.slice(0, written);
  }
  outputCapacity(inputLength: number) {
    return this.inputRate === this.outputRate
      ? inputLength
      : Math.max(0, Math.ceil((this.length + inputLength - 16 - this.position) / this.step));
  }
  /** Caller owns output; allows the worklet to reuse its scratch buffer. */
  pushInto(input: Float32Array, output: Float32Array): number {
    if (output.length < this.outputCapacity(input.length))
      throw new Error('Resampler output buffer too small');
    if (this.inputRate === this.outputRate) {
      output.set(input);
      return input.length;
    }
    if (this.length + input.length > this.buffer.length) {
      let capacity = this.buffer.length;
      while (capacity < this.length + input.length) capacity *= 2;
      const next = new Float32Array(capacity);
      for (let i = 0; i < this.length; i++)
        next[i] = this.buffer[(this.head + i) % this.buffer.length];
      this.buffer = next;
      this.head = 0;
    }
    for (let i = 0; i < input.length; i++)
      this.buffer[(this.head + this.length + i) % this.buffer.length] = input[i];
    this.length += input.length;
    let n = 0;
    while (this.position + 16 < this.length) {
      const center = Math.floor(this.position);
      const phase = Math.round((this.position - center) * PHASES) * 32;
      let sum = 0;
      for (let tap = 0; tap < 32; tap++)
        sum +=
          this.buffer[(this.head + center - 15 + tap) % this.buffer.length] *
          this.coefficients[phase + tap];
      output[n++] = sum;
      this.position += this.step;
    }
    const discard = Math.max(0, Math.floor(this.position) - 16);
    this.head = (this.head + discard) % this.buffer.length;
    this.length -= discard;
    this.position -= discard;
    return n;
  }
}
export interface SpeechChunk {
  samples: Float32Array;
  startSample: number;
  endSample: number;
  quality: SpeechAudioQuality;
  boundary?: 'silence' | 'limit' | 'finish';
  utteranceId?: string;
  prosody?: ProsodySummary;
}
export interface SpeechAudioQuality {
  speechRms: number;
  noiseRms: number;
  clippingRatio: number;
  noiseMeasured?: boolean;
}
/** File-lab heuristic only: without a quieter window, noise quality is unknown. */
export function estimateFileAudioQuality(samples: Float32Array): SpeechAudioQuality {
  const levels: number[] = [];
  for (let start = 0; start < samples.length; start += 512)
    levels.push(frameRms(samples.subarray(start, start + 512)));
  levels.sort((a, b) => a - b);
  const noiseRms = levels[Math.floor(levels.length * 0.2)] ?? 0;
  const speechRms = levels[Math.min(levels.length - 1, Math.floor(levels.length * 0.8))] ?? 0;
  return {
    speechRms,
    noiseRms,
    clippingRatio: countClipped(samples) / Math.max(1, samples.length),
    noiseMeasured: levels.length >= 25 && noiseRms < speechRms / 1.5,
  };
}
/** VAD boundaries with pre-roll, a bounded three-second chunk and local quality estimates. */
export class UtteranceBuilder {
  private frames: Float32Array[] = [];
  private preRoll: Float32Array[] = [];
  private preRollNoise: number[] = [];
  private noiseFrames: number[] = [];
  private speechLevels: number[] = [];
  private clippedSamples = 0;
  private totalSamples = 0;
  private start = 0;
  private speechFrames = 0;
  private silenceFrames = 0;
  private end = 0;
  private utteranceId: string | undefined;
  private prosody: ProsodyAccumulator | undefined;
  constructor(
    private collectProsody = false,
    private silenceHangoverFrames = 17,
  ) {}
  snapshot(
    policy: 'baseline' | 'early-candidate' | 'streaming-candidate' = 'baseline',
  ): SpeechChunk | null {
    const early = policy !== 'baseline';
    if (!this.frames.length || this.speechFrames < (early ? 16 : 25)) return null;
    // A full 800 ms window includes pre-roll/short pauses. Do not wait for
    // 800 ms of voiced frames, or start a new decode just before a silence final.
    if (
      early &&
      (this.frames.length < (policy === 'streaming-candidate' ? 16 : 25) || this.silenceFrames >= 4)
    )
      return null;
    return this.copyChunk();
  }
  flush(boundary: 'silence' | 'limit' | 'finish' = 'finish'): SpeechChunk | null {
    const valid = this.speechFrames >= 8;
    const chunk = valid ? { ...this.copyChunk(), boundary } : null;
    this.frames = [];
    this.preRoll = [];
    this.preRollNoise = [];
    this.noiseFrames = [];
    this.speechLevels = [];
    this.clippedSamples = 0;
    this.totalSamples = 0;
    this.speechFrames = 0;
    this.silenceFrames = 0;
    if (boundary !== 'limit') this.utteranceId = undefined;
    if (boundary !== 'limit') this.prosody = undefined;
    return chunk;
  }
  push(frame: Float32Array, speechScore: number, sampleOffset: number): SpeechChunk | null {
    this.end = sampleOffset + 512;
    const speaking = speechScore >= 0.5;
    const rms = frameRms(frame);
    if (!this.frames.length) {
      if (!speaking) {
        this.preRoll.push(frame);
        this.preRollNoise.push(rms);
        if (this.preRoll.length > 6) {
          this.preRoll.shift();
          this.preRollNoise.shift();
        }
        return null;
      }
      this.frames = this.preRoll;
      this.noiseFrames = [...this.preRollNoise];
      this.totalSamples = this.preRoll.length * 512;
      this.clippedSamples = this.preRoll.reduce((count, values) => count + countClipped(values), 0);
      this.start = sampleOffset - this.preRoll.length * 512;
      this.utteranceId ??= `speech-${this.start}`;
      if (this.collectProsody && !this.prosody) {
        this.prosody = new ProsodyAccumulator();
        this.preRoll.forEach((part) => this.prosody!.push(part));
      }
      this.preRoll = [];
      this.preRollNoise = [];
    }
    this.frames.push(frame);
    this.prosody?.push(frame);
    this.totalSamples += frame.length;
    this.clippedSamples += countClipped(frame);
    if (speaking) {
      this.speechFrames++;
      this.silenceFrames = 0;
      this.speechLevels.push(rms);
    } else {
      this.silenceFrames++;
      this.noiseFrames.push(rms);
    }
    if (this.silenceFrames < this.silenceHangoverFrames && this.frames.length < 94) return null;
    return this.flush(this.silenceFrames >= this.silenceHangoverFrames ? 'silence' : 'limit');
  }
  private copyChunk(): SpeechChunk {
    const samples = new Float32Array(this.frames.length * 512);
    this.frames.forEach((value, i) => samples.set(value, i * 512));
    return {
      samples,
      startSample: this.start,
      endSample: this.end,
      utteranceId: this.utteranceId,
      prosody: this.prosody?.summary(),
      quality: {
        speechRms: mean(this.speechLevels),
        noiseRms: median(this.noiseFrames.slice(-6)),
        noiseMeasured: this.noiseFrames.length > 0,
        clippingRatio: this.totalSamples ? this.clippedSamples / this.totalSamples : 0,
      },
    };
  }
}
function frameRms(frame: Float32Array) {
  let energy = 0;
  for (const value of frame) energy += value * value;
  return Math.sqrt(energy / Math.max(1, frame.length));
}
function countClipped(frame: Float32Array) {
  let count = 0;
  for (const value of frame) if (Math.abs(value) >= 0.99) count++;
  return count;
}
function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
export function normalizeWaveform(samples: Float32Array) {
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  return Float32Array.from(samples, (v) => (v - mean) / Math.sqrt(variance + 1e-7));
}
