/** PhoBERT's whitespace + fastBPE tokenizer. Ported against Transformers
 * 4.57.1 PhoBERTTokenizer (Apache-2.0); parity fixtures are generated in Python.
 * Does not pretend to perform Vietnamese word segmentation. The selected
 * fine-tune's model card uses raw text; this remains an evaluation assumption. */
export class PhoBertTokenizer {
  private vocabulary = new Map<string, number>([
    ['<s>', 0],
    ['<pad>', 1],
    ['</s>', 2],
    ['<unk>', 3],
  ]);
  private ranks = new Map<string, number>();
  private cache = new Map<string, string[]>();
  constructor(vocab: string, codes: string) {
    for (const line of vocab.trimEnd().split('\n')) {
      const token = line.slice(0, line.lastIndexOf(' '));
      if (token) this.vocabulary.set(token, this.vocabulary.size);
    }
    codes
      .trimEnd()
      .split('\n')
      .forEach((line, i) => {
        const pair = line.trim().split(/\s+/);
        if (pair.length >= 2) this.ranks.set(pair[0] + '\t' + pair[1], i);
      });
  }
  private bpe(token: string) {
    const cached = this.cache.get(token);
    if (cached) {
      this.cache.delete(token);
      this.cache.set(token, cached);
      return cached;
    }
    let word = Array.from(token);
    if (!word.length) return [];
    word[word.length - 1] += '</w>';
    while (word.length > 1) {
      let best = Infinity;
      let pair = '';
      for (let i = 0; i < word.length - 1; i++) {
        const key = word[i] + '\t' + word[i + 1];
        const rank = this.ranks.get(key) ?? Infinity;
        if (rank < best) {
          best = rank;
          pair = key;
        }
      }
      if (!pair) break;
      const next: string[] = [];
      for (let i = 0; i < word.length; i++) {
        if (i < word.length - 1 && word[i] + '\t' + word[i + 1] === pair) {
          next.push(word[i] + word[i + 1]);
          i++;
        } else next.push(word[i]);
      }
      word = next;
    }
    const result = word.map((part, i) => (i === word.length - 1 ? part.slice(0, -4) : part + '@@'));
    // Bounded per-worker token cache, not a transcript/phrase history.
    if (token.length <= 128) {
      if (this.cache.size >= 512) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(token, result);
    }
    return result;
  }
  encode(text: string, maximum = 128) {
    const tokens = (text.match(/\S+\n?/gu) ?? []).flatMap((token) => this.bpe(token));
    return [0, ...tokens.slice(0, maximum - 2).map((token) => this.vocabulary.get(token) ?? 3), 2];
  }
}
