import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PhoBertTokenizer } from '../src/infrastructure/inference/phobert-tokenizer';
import fixtures from './phobert-parity.json';
import { mapEmotionScores, PHOBERT_LABELS } from '../src/infrastructure/inference/emotion-provider';
import { speechError } from '../src/domain/speechMetrics';
describe('model preprocessing parity', () => {
  it('evicts least recently used tokens without changing IDs after eviction or caching long input', () => {
    const tiny = new PhoBertTokenizer('xin 1\nchào 1', 'x i\nxi n');
    const first = tiny.encode('xin chào');
    for (let i = 0; i < 700; i++) tiny.encode(`token${i}`);
    expect(tiny.encode('xin chào')).toEqual(first);
    expect((tiny as unknown as { cache: Map<string, string[]> }).cache.size).toBeLessThanOrEqual(
      512,
    );
    tiny.encode('x'.repeat(500));
    expect((tiny as unknown as { cache: Map<string, string[]> }).cache.has('x'.repeat(500))).toBe(
      false,
    );
  });
  const base = 'public/models/local/huyleit/phobert-emotion-social/';
  const tokenizer = new PhoBertTokenizer(
    readFileSync(base + 'vocab.txt', 'utf8'),
    readFileSync(base + 'bpe.codes', 'utf8'),
  );
  for (const fixture of fixtures)
    it(`matches Python token IDs: ${fixture.text}`, () => {
      expect(tokenizer.encode(fixture.text)).toEqual(fixture.ids);
    });
  it('preserves unsupported probability instead of turning Other or Calm neutral', () => {
    expect(
      mapEmotionScores([0, 0, 10, 0, 0, 0, 0], [...PHOBERT_LABELS]).scores.disgust,
    ).toBeGreaterThan(0.99);
    expect(
      mapEmotionScores([0, 0, 0, 0, 10, 0, 0], [...PHOBERT_LABELS]).scores.fear,
    ).toBeGreaterThan(0.99);
    expect(
      mapEmotionScores([0, 10, 0, 0, 0, 0, 0], [...PHOBERT_LABELS]).scores.sad,
    ).toBeGreaterThan(0.99);
    const output = mapEmotionScores([0, 10, 0], ['Sadness', 'Other', 'Enjoyment']);
    expect(output.unsupportedScore).toBeGreaterThan(0.99);
    expect(output.scores.neutral).toBeUndefined();
    expect(mapEmotionScores([10, 0], ['CAL', 'NEU']).unsupportedScore).toBeGreaterThan(0.99);
  });
});
it('scores Vietnamese accents and punctuation consistently without erasing diacritics', () => {
  expect(speechError('Xin chào, bạn!', 'xin chào bạn').wer).toBe(0);
  expect(speechError('Tôi buồn', 'Tôi vui').wer).toBe(0.5);
  expect(speechError('buồn', 'buon').cer).toBeGreaterThan(0);
});
