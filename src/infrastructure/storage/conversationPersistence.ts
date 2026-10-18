import type { ConversationRecord } from '../../domain/conversation';
import type { ConversationVault } from './vault';

export type SaveState = 'off' | 'ready' | 'locked' | 'saving' | 'saved' | 'error';

/** One encrypted write and one latest snapshot; never an unbounded promise chain. */
export class ConversationPersistence {
  state: SaveState = 'off';
  private pending: ConversationRecord | null = null;
  private writing = false;
  private version = 0;
  private completed = 0;
  private recordId = '';
  private epoch = 0;
  private listeners = new Set<() => void>();
  constructor(private vault: Pick<ConversationVault, 'save' | 'unlocked'>) {}
  get unsaved() {
    return this.version > this.completed;
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private publish(state: SaveState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  begin(record: ConversationRecord, enabled: boolean) {
    if (this.unsaved) return false;
    this.recordId = record.id;
    this.publish(enabled ? (this.vault.unlocked ? 'ready' : 'locked') : 'off');
    return true;
  }
  offer(record: ConversationRecord) {
    if (this.state === 'off' || record.id !== this.recordId || !record.segments.length) return;
    this.pending = record;
    this.version++;
    void this.drain();
  }
  sync() {
    if (this.unsaved && !this.vault.unlocked) this.publish('locked');
  }
  retry() {
    return this.drain();
  }
  discard() {
    if (this.writing) return false;
    this.clear();
    return true;
  }
  clear() {
    this.epoch++;
    this.pending = null;
    this.completed = this.version;
    this.publish('off');
  }
  private async drain() {
    if (this.writing || !this.pending || !this.unsaved) return;
    if (!this.vault.unlocked) {
      this.publish('locked');
      return;
    }
    this.writing = true;
    const epoch = this.epoch;
    this.publish('saving');
    try {
      while (this.pending && this.unsaved && this.vault.unlocked) {
        const version = this.version;
        const snapshot = structuredClone(this.pending);
        await this.vault.save(snapshot);
        if (epoch !== this.epoch) return;
        this.completed = version;
      }
      if (!this.unsaved) this.pending = null;
      this.publish(this.unsaved ? 'locked' : 'saved');
    } catch {
      if (epoch === this.epoch) this.publish(this.vault.unlocked ? 'error' : 'locked');
    } finally {
      this.writing = false;
      if (epoch !== this.epoch && this.pending) void this.drain();
    }
  }
}
