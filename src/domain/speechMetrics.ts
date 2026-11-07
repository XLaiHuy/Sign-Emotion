export function normalizeTranscript(text: string) {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Post-processes Whisper transcripts for Vietnamese on-device ASR:
 * - Normalizes unicode (NFC)
 * - Strips common subtitle tags and bracketed artifacts (e.g. "[âm nhạc]", "(vỗ tay)")
 * - Collapses repeated punctuation and whitespace
 * - Prunes pathological Whisper token repetition loops (e.g. "ừ ừ ừ ừ ừ..." or "tôi đi tôi đi tôi đi")
 * - Discards phantom hallucinations on background noise or silence.
 */
export function sanitizeTranscript(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.normalize('NFC').trim();

  // Strip hallucinated bracket tags: [...], (...), <...>
  text = text.replace(/\[.*?\]/g, ' ').replace(/\(.*?\)/g, ' ').replace(/<.*?>/g, ' ');

  // Strip repeated ellipses and dashes
  text = text.replace(/[.·•]{2,}/g, '.').replace(/[-_—]{2,}/g, ' ');

  // Normalize excessive spaces
  text = text.replace(/\s+/gu, ' ').trim();

  // Filter phantom Whisper hallucinations on silence / non-speech
  const normalized = text.toLocaleLowerCase('vi');
  const phantomPatterns = [
    /^(cảm ơn các bạn( đã theo dõi| đã xem)?|hãy đăng ký kênh|hẹn gặp lại các bạn|chúc các bạn một ngày tốt lành)[.!?,]*$/i,
    /^(thank you( very much)?|subtitles by|transcribed by|copyright)[.!?,]*$/i,
    /^bệnh nhân[.!?,]*$/i,
    /^[.,!?:;'"_—\-–\s]+$/,
  ];
  if (phantomPatterns.some((pattern) => pattern.test(normalized))) {
    return '';
  }

  // Deduplicate consecutive identical words repeated 3+ times (Whisper loop bug)
  // e.g. "tôi tôi tôi tôi" -> "tôi", "dạ dạ dạ" -> "dạ"
  text = text.replace(/(?:^|(?<=[^\p{L}\p{N}]))(\p{L}+)(?:\s+\1){2,}(?=[^\p{L}\p{N}]|$)/giu, '$1');

  // Deduplicate consecutive identical 2-word phrases repeated 3+ times
  // e.g. "xin chào xin chào xin chào" -> "xin chào"
  text = text.replace(
    /(?:^|(?<=[^\p{L}\p{N}]))(\p{L}+\s+\p{L}+)(?:\s+\1){2,}(?=[^\p{L}\p{N}]|$)/giu,
    '$1',
  );

  return text.trim();
}
export function editDistance(a: string[], b: string[]) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(Math.min(previous[j + 1] + 1, next[j] + 1, previous[j] + (a[i] === b[j] ? 0 : 1)));
    previous = next;
  }
  return previous[b.length];
}
export function speechError(reference: string, hypothesis: string) {
  const expected = normalizeTranscript(reference),
    actual = normalizeTranscript(hypothesis);
  const words = expected ? expected.split(' ') : [],
    predicted = actual ? actual.split(' ') : [];
  const chars = Array.from(expected.replaceAll(' ', '')),
    output = Array.from(actual.replaceAll(' ', ''));
  return {
    wordErrors: editDistance(words, predicted),
    referenceWords: words.length,
    charErrors: editDistance(chars, output),
    referenceChars: chars.length,
    wer: words.length ? editDistance(words, predicted) / words.length : null,
    cer: chars.length ? editDistance(chars, output) / chars.length : null,
  };
}
