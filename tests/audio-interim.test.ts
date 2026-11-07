import { expect, it } from 'vitest';
import { UtteranceBuilder } from '../src/domain/audio';

it('creates interim snapshots without consuming the final utterance buffer', () => {
  const builder = new UtteranceBuilder();
  let final: ReturnType<UtteranceBuilder['push']> = null;
  for (let frame = 0; frame < 25; frame++)
    final = builder.push(new Float32Array(512).fill(0.05), 0.9, frame * 512);
  const interim = builder.snapshot();
  expect(final).toBeNull();
  expect(interim?.samples).toHaveLength(25 * 512);
  for (let frame = 25; frame < 42; frame++)
    final = builder.push(new Float32Array(512), 0, frame * 512);
  expect(final?.samples).toHaveLength(42 * 512);
});

it('preserves long multi-second Vietnamese sentences (e.g. 8s / 250 frames) without mid-word 3s truncation when maxFrames=375', () => {
  const builder = new UtteranceBuilder(false, 16, 375);
  let emittedMidSentence = false;
  for (let frame = 0; frame < 250; frame++) {
    const chunk = builder.push(new Float32Array(512).fill(0.02), 0.9, frame * 512);
    if (chunk) emittedMidSentence = true;
  }
  expect(emittedMidSentence).toBe(false);

  let finalChunk: ReturnType<UtteranceBuilder['push']> = null;
  for (let frame = 250; frame < 266; frame++) {
    finalChunk = builder.push(new Float32Array(512), 0, frame * 512);
  }
  expect(finalChunk).not.toBeNull();
  expect(finalChunk?.boundary).toBe('silence');
  expect(finalChunk?.samples).toHaveLength(266 * 512);
});

it('carries over 6 pre-roll overlap frames when continuous speech reaches the 12s (375-frame) limit', () => {
  const builder = new UtteranceBuilder(false, 16, 375);
  let limitChunk: ReturnType<UtteranceBuilder['push']> = null;
  for (let frame = 0; frame < 375; frame++) {
    limitChunk = builder.push(new Float32Array(512).fill(0.02), 0.9, frame * 512);
  }
  expect(limitChunk?.boundary).toBe('limit');
  expect(limitChunk?.samples).toHaveLength(375 * 512);

  // Next 12 speech frames + flush should include the 6 carried-over preRoll frames (18 total)
  for (let frame = 375; frame < 387; frame++) {
    builder.push(new Float32Array(512).fill(0.02), 0.9, frame * 512);
  }
  const continuation = builder.flush('finish');
  expect(continuation?.samples).toHaveLength(18 * 512);
});
