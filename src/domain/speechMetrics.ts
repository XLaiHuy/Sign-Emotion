export function normalizeTranscript(text: string) {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
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
