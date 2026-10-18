interface Snapshot {
  id: string;
  revision: number;
  text: string;
  committedWords: number;
}
const normalize = (text: string) => text.normalize('NFC').replace(/\s+/gu, ' ').trim();
const key = (word: string) => word.toLocaleLowerCase('vi-VN').replace(/^[\p{P}]+|[\p{P}]+$/gu, '');
// Presentation boundaries only: this is not Vietnamese word segmentation.
const boundPairs = new Set([
  'không sao',
  'cảm ơn',
  'bây giờ',
  'đồng ý',
  'xin chào',
  'có thể',
  'chưa từng',
  'không thể',
]);

/** UI-only, bounded local agreement. Finals always override; never edits ASR evidence. */
export class PartialCaptionStabilizer {
  private previous: string[] = [];
  private committed: string[] = [];
  private snapshot: Snapshot | null = null;
  private previousEndMs: number | undefined;
  private stableSince: number[] = [];
  reset() {
    this.previous = [];
    this.committed = [];
    this.snapshot = null;
    this.previousEndMs = undefined;
    this.stableSince = [];
  }
  update(id: string, revision: number, raw: string, endMs?: number): Snapshot {
    if (this.snapshot?.id !== id) this.reset();
    if (this.snapshot && revision <= this.snapshot.revision) return this.snapshot;
    if (endMs !== undefined && this.previousEndMs !== undefined && endMs < this.previousEndMs)
      this.reset();
    const text = normalize(raw);
    const words = text ? text.split(' ') : [];
    if (!words.length || words.length > 256) {
      this.reset();
      return (this.snapshot = { id, revision, text, committedWords: 0 });
    }
    let common = 0;
    while (
      common < Math.min(this.previous.length, words.length) &&
      key(this.previous[common]) !== '' &&
      key(this.previous[common]) === key(words[common])
    )
      common++;
    // Never lock the last word, which may still be incomplete.
    let agreed = Math.min(common, this.previous.length - 1, words.length - 1);
    const stableSince = words.map((_, index) =>
      index < common ? (this.stableSince[index] ?? endMs ?? 0) : (endMs ?? 0),
    );
    if (endMs !== undefined) {
      let timed = 0;
      while (timed < agreed && endMs - stableSince[timed] >= 400) timed++;
      agreed = timed;
    }
    if (agreed > 0 && boundPairs.has(`${key(words[agreed - 1])} ${key(words[agreed])}`)) agreed--;
    let compatible = 0;
    while (
      compatible < Math.min(this.committed.length, words.length) &&
      key(this.committed[compatible]) === key(words[compatible])
    )
      compatible++;
    // Contradictions (especially negation/numbers) release the affected prefix immediately.
    const shorterPrefix = words.length < this.committed.length && compatible === words.length;
    if (!shorterPrefix) this.committed = this.committed.slice(0, compatible);
    for (let i = this.committed.length; i < agreed; i++) this.committed.push(this.previous[i]);
    const displayWords = shorterPrefix ? this.committed : words;
    const display = displayWords
      .map((word, index) => {
        const stable = this.committed[index];
        return stable && key(stable) === key(word)
          ? word.replace(
              /[\p{L}\p{M}\p{N}]+/u,
              (body) => stable.match(/[\p{L}\p{M}\p{N}]+/u)?.[0] ?? body,
            )
          : word;
      })
      .join(' ');
    this.previous = words;
    this.previousEndMs = endMs;
    this.stableSince = stableSince;
    return (this.snapshot = { id, revision, text: display, committedWords: this.committed.length });
  }
}
