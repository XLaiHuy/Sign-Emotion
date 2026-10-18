import { it as test } from 'vitest';
import assert from 'node:assert/strict';
import { clampTail, score } from './audio-clamping-metrics.mjs';

test('alignment distinguishes deletions, substitutions and intentional repetition', () => {
  const result = score('tôi không đồng ý', 'tôi đồng ý');
  assert.equal(result.deletions, 1);
  assert.equal(result.substitutions, 0);
  assert.equal(result.wer, 0.25);
  assert.equal(score('đi đi', 'đi').deletions, 1);
  assert.equal(score('tôi vui', 'tôi buồn').substitutions, 1);
  assert.equal(score('tôi vui', 'tôi vui hôm nay').insertions, 2);
  assert.equal(score('CẢM ƠN!', 'cảm ơn').errors, 0);
});
test('tail deletion proxy detects missing last words without charging early omissions', () => {
  assert.equal(score('một hai ba bốn năm', 'hai ba bốn năm').tailDeletions, 0);
  assert.equal(score('một hai ba bốn năm', 'một hai ba bốn').tailDeletions, 1);
});
test('candidate only changes final 200 ms with an independently measured floor', () => {
  const original = new Float32Array(16000).fill(0.2);
  original.fill(0.001, 12800);
  const candidate = clampTail(original, 0.002, true);
  assert.equal(candidate.applied, true);
  assert.deepEqual(candidate.samples.subarray(0, 12800), original.subarray(0, 12800));
  assert.equal(candidate.samples[15999], 0);
  assert.notEqual(original[15999], 0);
  assert.equal(clampTail(original, 0.002, false).applied, false);
  assert.equal(clampTail(original, 0, true).applied, false);
  original.fill(0.03, 12800);
  assert.equal(clampTail(original, 0.5, true).applied, false);
  assert.throws(() => clampTail(original, 0.002, true, 48000));
});
