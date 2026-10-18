import { describe, expect, it } from 'vitest';
import {
  evaluateRows,
  evaluationCsv,
  referenceAt,
  segmentsSchema,
  youtubeId,
  type EvaluationRow,
} from '../src/domain/evaluation';
describe('video evaluation contracts', () => {
  it('uses half-open non-overlapping segments and excludes unannotated samples', () => {
    const segments = segmentsSchema.parse([
      { startMs: 0, endMs: 1000, label: 'sad' },
      { startMs: 1000, endMs: 2000, label: 'neutral' },
    ]);
    expect(referenceAt(1000, segments)).toBe('neutral');
    expect(referenceAt(2000, segments)).toBe('ignore');
    expect(() =>
      segmentsSchema.parse([...segments, { startMs: 800, endMs: 1200, label: 'happy' }]),
    ).toThrow();
    const row = (
      timeMs: number,
      predicted: EvaluationRow['predicted'],
      trigger: EvaluationRow['trigger'] = null,
    ): EvaluationRow => ({
      timeMs,
      predicted,
      trigger,
      rawScores: [],
      smoothedScores: [],
      status: 'valid',
      processingMs: 1,
      reason: '',
    });
    const report = evaluateRows(
      [
        row(0, 'sad', 'sad'),
        row(200, 'uncertain'),
        row(1000, 'sad', 'sad'),
        row(2000, 'happy', 'happy'),
      ],
      segments,
    );
    expect(report.labeledSamples).toBe(3);
    expect(report.perClass.sad.recall).toBe(0.5);
    expect(report.perClass.sad.precision).toBe(0.5);
    expect(report.falseTriggers).toBe(1);
    expect(report.confusion.neutral.sad).toBe(1);
    const csv = evaluationCsv([row(0, 'uncertain')], segments).split('\r\n');
    expect(csv[1].split(',')).toHaveLength(csv[0].split(',').length);
  });
  it('only accepts known HTTPS YouTube links without injecting arbitrary iframe URLs', () => {
    expect(youtubeId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk');
    expect(youtubeId('https://www.youtube.com/watch?v=abcdefghijk')).toBe('abcdefghijk');
    expect(youtubeId('https://evil.test/watch?v=abcdefghijk')).toBeNull();
    expect(youtubeId('javascript:alert(1)')).toBeNull();
  });
});
