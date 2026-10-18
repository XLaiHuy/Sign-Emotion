import { expect, it } from 'vitest';
import { ToneModel } from '../src/infrastructure/inference/tone-model';
import { mapEmotionScores } from '../src/infrastructure/inference/emotion-provider';

it('does not run a tone model on silence, invalid PCM or undersized speech', async () => {
  const tone = new ToneModel();
  expect((await tone.infer(new Float32Array(48000), 0, 3000)).quality).toBe('rejected');
  expect((await tone.infer(new Float32Array(4000).fill(0.1), 0, 250)).quality).toBe('rejected');
  expect((await tone.infer(new Float32Array(12800).fill(NaN), 0, 800)).quality).toBe('rejected');
  expect((await tone.infer(new Float32Array(12800).fill(1.2), 0, 800)).quality).toBe('rejected');
  await tone.dispose();
});

it('does not turn unsupported tone labels into neutral or discard their mass', () => {
  const names = [
    'angry',
    'disgusted',
    'fearful',
    'happy',
    'neutral',
    'other',
    'sad',
    'surprised',
    'unknown',
  ];
  const output = mapEmotionScores([0, 0, 0, 0, 0, 8, 0, 0, 8], names);
  expect(output.unsupportedScore).toBeGreaterThan(0.99);
  expect(output.scores.neutral).toBeLessThan(0.01);
});
