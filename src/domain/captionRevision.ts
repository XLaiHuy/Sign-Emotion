export interface CaptionRevision {
  text: string;
  original: string;
  changed: boolean;
  revision: number;
}

interface WordSpan {
  value: string;
  start: number;
  end: number;
}

function wordSpans(text: string): WordSpan[] {
  return [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’.-]*/gu)].map((match) => ({
    value: match[0].toLocaleLowerCase('vi-VN'),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

/** Flag decoder loops instead of presenting repeated filler as a trustworthy caption. */
export function isSuspiciousRecognition(text: string): boolean {
  const words = wordSpans(text).map((word) => word.value);
  if (words.length < 8) return false;
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  if (Math.max(...counts.values()) >= Math.max(6, Math.ceil(words.length * 0.4))) return true;
  const pairs = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]}\u0000${words[i + 1]}`;
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  return [...pairs.values()].some((count) => count >= 3 && count * 2 >= words.length - 1);
}

/**
 * Applies only reversible-safe display cleanup and exact multi-word overlap removal.
 * It does not rewrite meaning, negation, names or numbers based on a language guess.
 */
export interface CaptionOverlap {
  previousEndMs: number;
  currentStartMs: number;
  sameUtterance: boolean;
}

export function reviseCaption(
  rawText: string,
  recentCaptions: string[] = [],
  overlap?: CaptionOverlap,
): CaptionRevision {
  const original = rawText.normalize('NFC').trim();
  let text = original.replace(/\s+/gu, ' ').replace(/\s+([,.;:!?…])/gu, '$1');
  const previous = recentCaptions.slice(-2).join(' ');
  const previousWords = wordSpans(previous);
  const currentWords = wordSpans(text);
  const maxOverlap = Math.min(3, previousWords.length, currentWords.length);

  const hasAudioOverlap =
    overlap?.sameUtterance === true &&
    Number.isFinite(overlap.previousEndMs) &&
    Number.isFinite(overlap.currentStartMs) &&
    overlap.previousEndMs > overlap.currentStartMs;
  for (let overlap = hasAudioOverlap ? maxOverlap : 0; overlap >= 2; overlap--) {
    const left = previousWords.slice(-overlap).map((word) => word.value);
    const right = currentWords.slice(0, overlap).map((word) => word.value);
    if (!left.every((word, index) => word === right[index])) continue;
    const boundary = currentWords[overlap - 1]?.end;
    if (boundary === undefined) break;
    text = text
      .slice(boundary)
      .replace(/^[\s,.;:!?…–—-]+/u, '')
      .trim();
    break;
  }

  return {
    text,
    original,
    changed: text !== original,
    revision: text === original ? 0 : 1,
  };
}
