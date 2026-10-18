import type { SignPhraseItem } from './signPhrasesCatalogue';
import { normalizeSignPhrase, findPlayableSignPhrase } from '../signPhrases';

export interface SignRequest {
  id: string;
  text: string;
  phrase: SignPhraseItem;
}
export class SignPlaybackQueue {
  current: SignRequest | null = null;
  pending: SignRequest | null = null;
  private seen = new Map<string, string>();
  update(items: { id: string; text: string }[], catalogue: readonly SignPhraseItem[]) {
    const texts = new Map(items.map((item) => [item.id, normalizeSignPhrase(item.text)]));
    if (
      this.current &&
      texts.has(this.current.id) &&
      texts.get(this.current.id) !== normalizeSignPhrase(this.current.text)
    )
      this.current = null;
    if (this.pending && texts.get(this.pending.id) !== normalizeSignPhrase(this.pending.text))
      this.pending = null;
    for (const item of items) {
      if (this.seen.has(item.id)) continue;
      this.seen.set(item.id, normalizeSignPhrase(item.text));
      const phrase = findPlayableSignPhrase(item.text, catalogue);
      if (!phrase) {
        this.pending = null;
        continue;
      }
      const request = { ...item, phrase };
      if (!this.current) this.current = request;
      else this.pending = request;
    }
    while (this.seen.size > 500) this.seen.delete(this.seen.keys().next().value!);
  }
  finish() {
    this.current = this.pending;
    this.pending = null;
  }
  dismiss() {
    this.current = null;
    this.pending = null;
  }
  clear() {
    this.current = null;
    this.pending = null;
    this.seen.clear();
  }
}
