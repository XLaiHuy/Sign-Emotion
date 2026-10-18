import { expect, it } from 'vitest';
import { StreamingResampler } from '../src/domain/audio';

it('reuses caller-owned output with the same samples at 48/44.1/16 kHz and rejects undersized buffers before consuming input', () => {
  for (const rate of [48000, 44100, 16000]) {
    const allocating = new StreamingResampler(rate),
      reused = new StreamingResampler(rate);
    const scratch = new Float32Array(128);
    for (let block = 0; block < 80; block++) {
      const input = Float32Array.from({ length: 128 }, (_, i) => Math.sin((block * 128 + i) * 0.1));
      const expected = allocating.push(input);
      if (expected.length)
        expect(() => reused.pushInto(input, new Float32Array(expected.length - 1))).toThrow();
      const written = reused.pushInto(input, scratch);
      expect(Array.from(scratch.subarray(0, written))).toEqual(Array.from(expected));
    }
  }
});

it('matches the original sinc reference at fractional 44.1-kHz phases without block-boundary loss', () => {
  const rate = 44100;
  const input = Float32Array.from(
    { length: 8192 },
    (_, i) =>
      Math.sin((2 * Math.PI * 1000 * i) / rate) * 0.5 +
      Math.sin((2 * Math.PI * 3500 * i) / rate) * 0.1,
  );
  const padded = new Float32Array(input.length + 16);
  padded.set(input, 16);
  const reference: number[] = [];
  const cutoff = (16000 / rate) * 0.9;
  for (let position = 16; position + 16 < padded.length; position += rate / 16000) {
    const center = Math.floor(position);
    let value = 0;
    let total = 0;
    for (let k = -15; k <= 16; k++) {
      const delta = center + k - position;
      const x = Math.PI * cutoff * delta;
      const weight =
        cutoff *
        (Math.abs(x) < 1e-8 ? 1 : Math.sin(x) / x) *
        (0.5 + 0.5 * Math.cos((Math.PI * delta) / 16));
      value += padded[center + k] * weight;
      total += weight;
    }
    reference.push(value / total);
  }
  const converter = new StreamingResampler(rate);
  const output: number[] = [];
  for (let start = 0; start < input.length; start += 127)
    output.push(...converter.push(input.subarray(start, start + 127)));
  expect(output.length).toBe(reference.length);
  expect(
    Math.max(...output.map((value, index) => Math.abs(value - reference[index]))),
  ).toBeLessThan(0.00015);
});
