import { describe, expect, it, vi } from 'vitest';
import { ConversationPersistence } from '../src/infrastructure/storage/conversationPersistence';
import { ConversationVault } from '../src/infrastructure/storage/vault';
import { db } from '../src/infrastructure/storage/database';
import type { ConversationRecord } from '../src/domain/conversation';

const record = (): ConversationRecord => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  segments: [
    {
      id: 'a',
      text: 'Nội dung riêng tư',
      startMs: 0,
      endMs: 100,
      modelVersion: 'fixture',
      processingMs: 1,
      finalizedAtMs: 110,
    },
  ],
  decisions: [],
});
describe('bounded encrypted history writes', () => {
  it('keeps only the newest waiting snapshot and never overlaps writes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const save = vi
      .fn()
      .mockImplementationOnce(() => gate)
      .mockResolvedValue(undefined);
    const writer = new ConversationPersistence({ unlocked: true, save });
    const value = record();
    writer.begin(value, true);
    writer.offer(value);
    for (let i = 0; i < 100; i++) {
      value.segments[0].text = `revision ${i}`;
      writer.offer(value);
    }
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].segments[0].text).toBe('Nội dung riêng tư');
    release();
    await vi.waitFor(() => expect(writer.state).toBe('saved'));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].segments[0].text).toBe('revision 99');
    expect(writer.unsaved).toBe(false);
  });
  it('retains pending text through lock and failures; retries after unlocking', async () => {
    const vault = {
      unlocked: false,
      save: vi.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValue(undefined),
    };
    const writer = new ConversationPersistence(vault),
      value = record();
    writer.begin(value, true);
    writer.offer(value);
    expect(writer.state).toBe('locked');
    expect(vault.save).not.toHaveBeenCalled();
    expect(writer.begin(record(), true)).toBe(false);
    vault.unlocked = true;
    await writer.retry();
    expect(writer.state).toBe('error');
    expect(writer.unsaved).toBe(true);
    await writer.retry();
    expect(writer.state).toBe('saved');
    expect(writer.unsaved).toBe(false);
  });
  it('does not persist without consent', async () => {
    const save = vi.fn(),
      writer = new ConversationPersistence({ unlocked: true, save });
    const value = record();
    writer.begin(value, false);
    writer.offer(value);
    await writer.retry();
    expect(save).not.toHaveBeenCalled();
    expect(writer.state).toBe('off');
  });
  it('does not resurrect discarded pending text after a vault reset', async () => {
    const vault = { unlocked: false, save: vi.fn() };
    const writer = new ConversationPersistence(vault),
      value = record();
    writer.begin(value, true);
    writer.offer(value);
    writer.clear();
    vault.unlocked = true;
    await writer.retry();
    expect(vault.save).not.toHaveBeenCalled();
    expect(writer.unsaved).toBe(false);
  });
  it('round-trips committed final text after replacing the vault instance', async () => {
    await db.conversations.clear();
    await db.vault.clear();
    const vault = new ConversationVault();
    await vault.create('long-test-password');
    const writer = new ConversationPersistence(vault),
      value = record();
    writer.begin(value, true);
    writer.offer(value);
    await vi.waitFor(() => expect(writer.state).toBe('saved'));
    expect(JSON.stringify(await db.conversations.toArray())).not.toContain('Nội dung riêng tư');
    vault.lock();
    const reopened = new ConversationVault();
    await reopened.unlock('long-test-password');
    expect((await reopened.list())[0]).toEqual(value);
    await db.conversations.clear();
    await db.vault.clear();
    reopened.lock();
  });
});
