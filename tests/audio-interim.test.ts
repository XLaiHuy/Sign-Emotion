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
