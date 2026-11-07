import { describe, expect, it } from 'vitest';
import {
  ASR_GAIN_NORMALIZATION,
  UtteranceBuilder,
  applyAsrGain,
  computeAsrGainParams,
  normalizeAsrPcm,
} from '../src/domain/audio';

describe('ASR Gain Normalization & Noise Gate', () => {
  it('exports rollback switch ASR_GAIN_NORMALIZATION defaulting to false on live mic', () => {
    expect(ASR_GAIN_NORMALIZATION).toBe(false);
  });

  it('amplifies quiet speech toward target RMS ~0.08 when explicitly enabled', () => {
    // Construct quiet speech waveform (e.g. RMS = 0.02, peak = 0.02828)
    const samples = new Float32Array(16000);
    for (let i = 0; i < samples.length; i++) {
      // 200 Hz tone at 16 kHz sample rate with amplitude 0.02 * sqrt(2) ~ 0.02828
      samples[i] = 0.028284 * Math.sin((2 * Math.PI * 200 * i) / 16000);
    }
    const params = computeAsrGainParams(samples, true);
    // RMS is ~0.02, 0.08 / 0.02 = 4. Peak is ~0.028, 0.92 / 0.028 = ~32. Gain = min(4, 32, 4) = 4.
    expect(params.gain).toBeGreaterThan(3.5);
    expect(params.gain).toBeLessThanOrEqual(4);

    const normalized = normalizeAsrPcm(samples, true);
    let energy = 0;
    for (let i = 0; i < normalized.length; i++) {
      energy += normalized[i] * normalized[i];
    }
    const normalizedRms = Math.sqrt(energy / normalized.length);
    expect(normalizedRms).toBeCloseTo(0.08, 2);
  });

  it('holds gain=1 on near-silence and ambient room noise below 0.012 RMS (noise gate)', () => {
    // Pure silence
    const silence = new Float32Array(16000);
    const silenceParams = computeAsrGainParams(silence, true);
    expect(silenceParams.gain).toBe(1);
    expect(silenceParams.mean).toBe(0);

    // Ambient room noise below threshold (0.012)
    const lowNoise = new Float32Array(16000);
    for (let i = 0; i < lowNoise.length; i++) {
      lowNoise[i] = 0.008 * Math.sin(i);
    }
    const noiseParams = computeAsrGainParams(lowNoise, true);
    expect(noiseParams.gain).toBe(1);

    const output = normalizeAsrPcm(lowNoise, true);
    for (let i = 0; i < output.length; i++) {
      expect(output[i]).toBeCloseTo(lowNoise[i] - noiseParams.mean, 5);
    }
  });

  it('discards ambient-hiss-only chunks (< 0.008 RMS) in UtteranceBuilder.flush', () => {
    const builder = new UtteranceBuilder();
    const faintNoise = new Float32Array(512).fill(0.003);
    for (let i = 0; i < 12; i++) {
      builder.push(faintNoise, 0.9, i * 512);
    }
    expect(builder.flush()).toBeNull();
  });

  it('strictly bounds peak to <= 0.92 to prevent digital clipping', () => {
    // High-peak signal with low RMS (e.g. peak = 0.5, RMS = 0.02)
    const burst = new Float32Array(16000);
    burst[100] = 0.5;
    burst[101] = -0.5;
    for (let i = 200; i < 4000; i++) {
      burst[i] = 0.05 * Math.sin(i);
    }
    const params = computeAsrGainParams(burst, true);
    // 0.92 / 0.5 = 1.84, which is less than 0.08 / rms
    expect(params.gain).toBeLessThanOrEqual(1.85);

    const normalized = applyAsrGain(burst, params);
    let peak = 0;
    for (let i = 0; i < normalized.length; i++) {
      const abs = Math.abs(normalized[i]);
      if (abs > peak) peak = abs;
    }
    expect(peak).toBeLessThanOrEqual(0.92001);
  });

  it('never mutates the input Float32Array in-place and returns a fresh copy', () => {
    const input = new Float32Array([0.02, -0.01, 0.03, -0.02]);
    const originalCopy = new Float32Array(input);
    const output = normalizeAsrPcm(input);

    expect(output).not.toBe(input);
    expect(input).toEqual(originalCopy);
  });

  it('disables gain boost when enabled is false (rollback switch behavior)', () => {
    const quiet = new Float32Array(16000).fill(0.02);
    quiet[0] = 0.05;
    const params = computeAsrGainParams(quiet, false);
    expect(params.gain).toBe(1);

    const normalized = normalizeAsrPcm(quiet, false);
    expect(normalized.length).toBe(quiet.length);
    // With gain 1, normalized is just DC-centered
    expect(normalized[0]).toBeCloseTo(quiet[0] - params.mean, 5);
  });
});
