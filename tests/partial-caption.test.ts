import { expect, it } from 'vitest';
import { PartialCaptionStabilizer } from '../src/domain/partialCaption';

it('waits for media-time separation and binds common two-syllable boundaries without hiding corrections', () => {
  const display = new PartialCaptionStabilizer();
  display.update('a', 1, 'Tôi cảm ơn', 800);
  expect(display.update('a', 2, 'Tôi cảm ơn bạn', 900).committedWords).toBe(0);
  expect(display.update('a', 3, 'Tôi cảm ơn bạn nhiều', 1700).committedWords).toBe(3);
  display.reset();
  display.update('b', 1, 'Tôi cảm', 800);
  expect(display.update('b', 2, 'Tôi cảm ơn', 1600).committedWords).toBe(1);
  expect(display.update('b', 3, 'Tôi không cảm ơn', 2400).text).toBe('Tôi không cảm ơn');
});
it('accumulates stable duration across frequent updates and resets after a backwards media clock', () => {
  const display = new PartialCaptionStabilizer();
  display.update('a', 1, 'Tôi rất vui', 800);
  expect(display.update('a', 2, 'Tôi rất vui', 1000).committedWords).toBe(0);
  expect(display.update('a', 3, 'Tôi rất vui', 1200).committedWords).toBe(2);
  expect(display.update('a', 4, 'Tôi rất vui', 200).committedWords).toBe(0);
});

it('renders immediately, agrees over two windows and holds a shortened stable prefix', () => {
  const display = new PartialCaptionStabilizer();
  expect(display.update('a', 1, 'Tôi đang đọc sách').committedWords).toBe(0);
  expect(display.update('a', 2, 'tôi đang đọc sách mới')).toMatchObject({
    text: 'Tôi đang đọc sách mới',
    committedWords: 3,
  });
  expect(display.update('a', 3, 'Tôi đang').text).toBe('Tôi đang đọc');
  expect(display.update('a', 4, 'Tôi đang đọc báo').text).toBe('Tôi đang đọc báo');
});

it('releases contradictions immediately rather than hide corrected negation or numbers', () => {
  const display = new PartialCaptionStabilizer();
  display.update('a', 1, 'Tôi đồng ý trả 10 đồng');
  display.update('a', 2, 'Tôi đồng ý trả 10 đồng nhé');
  expect(display.update('a', 3, 'Tôi không đồng ý trả 20 đồng').text).toBe(
    'Tôi không đồng ý trả 20 đồng',
  );
  expect(display.update('a', 4, 'Tôi không đồng ý trả 21 đồng').text).toContain('21');
});

it('keeps Vietnamese diacritics, punctuation, deliberate repetition and ignores stale revisions', () => {
  const display = new PartialCaptionStabilizer();
  display.update('a', 1, 'Tôi rất rất vui');
  const next = display.update('a', 2, 'Tôi rất rất vui!'.normalize('NFD'));
  expect(next.text).toBe('Tôi rất rất vui!');
  expect(display.update('a', 1, 'sai')).toEqual(next);
  expect(display.update('b', 1, 'Câu mới').committedWords).toBe(0);
  display.reset();
  expect(display.update('b', 2, 'Câu mới nữa').committedWords).toBe(0);
});

it('does not retain agreement state for pathological windows or empty output', () => {
  const display = new PartialCaptionStabilizer();
  const long = Array(300).fill('từ').join(' ');
  expect(display.update('a', 1, long)).toMatchObject({ text: long, committedWords: 0 });
  expect(display.update('a', 2, '').text).toBe('');
  expect(display.update('a', 3, 'xin chào').committedWords).toBe(0);
});
