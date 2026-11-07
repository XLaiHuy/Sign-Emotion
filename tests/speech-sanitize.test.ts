import { describe, expect, it } from 'vitest';
import { sanitizeTranscript } from '../src/domain/speechMetrics';

describe('Vietnamese ASR transcript sanitizer', () => {
  it('normalizes NFC and trims whitespace', () => {
    // Normalization test with composed vs decomposed characters
    const decomposed = 'ba\u0300n'; // b + a + combining grave accent
    expect(sanitizeTranscript(decomposed)).toBe('bàn');
    expect(sanitizeTranscript('  Xin chào   bạn   ')).toBe('Xin chào bạn');
  });

  it('removes subtitle tags and bracketed artifacts', () => {
    expect(sanitizeTranscript('[âm nhạc] Xin chào các bạn (tiếng cười)')).toBe('Xin chào các bạn');
    expect(sanitizeTranscript('<vỗ tay> Rất vui được gặp bạn')).toBe('Rất vui được gặp bạn');
  });

  it('collapses repeated punctuation and dashes', () => {
    expect(sanitizeTranscript('Xin chào các bạn...')).toBe('Xin chào các bạn.');
    expect(sanitizeTranscript('Xin chào các bạn---rất vui')).toBe('Xin chào các bạn rất vui');
  });

  it('prunes Whisper pathological token repetition loops', () => {
    expect(sanitizeTranscript('tôi tôi tôi tôi đi học')).toBe('tôi đi học');
    expect(sanitizeTranscript('xin chào xin chào xin chào mọi người')).toBe('xin chào mọi người');
    expect(sanitizeTranscript('dạ dạ dạ')).toBe('dạ');
  });

  it('discards phantom Whisper hallucinations on silence or background noise', () => {
    expect(sanitizeTranscript('Cảm ơn các bạn đã theo dõi.')).toBe('');
    expect(sanitizeTranscript('Cảm ơn các bạn đã xem')).toBe('');
    expect(sanitizeTranscript('Hãy đăng ký kênh!')).toBe('');
    expect(sanitizeTranscript('bệnh nhân.')).toBe('');
    expect(sanitizeTranscript('Bệnh nhân!')).toBe('');
    expect(sanitizeTranscript('...')).toBe('');
    expect(sanitizeTranscript('---')).toBe('');
    expect(sanitizeTranscript('  ')).toBe('');
  });

  it('preserves legitimate speech sentences with punctuation and tone marks', () => {
    const sentence = 'Hôm nay trời rất đẹp, bạn cảm thấy thế nào?';
    expect(sanitizeTranscript(sentence)).toBe(sentence);
    expect(sanitizeTranscript('Tôi là bệnh nhân.')).toBe('Tôi là bệnh nhân.');
  });
});
