import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/infrastructure/storage/database';
import { ConversationVault } from '../src/infrastructure/storage/vault';
import type { ConversationRecord } from '../src/domain/conversation';
beforeEach(async () => {
  await db.conversations.clear();
  await db.vault.clear();
});
const record = (): ConversationRecord => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  segments: [
    {
      id: 'segment',
      startMs: 0,
      endMs: 1000,
      text: 'Nội dung riêng tư',
      modelVersion: 'test',
      processingMs: 10,
      finalizedAtMs: 2000,
    },
  ],
  decisions: [],
});
describe('encrypted local conversation history', () => {
  it('round-trips the new labels alongside legacy decisions without changing vault schema', async () => {
    const vault = new ConversationVault();
    await vault.create('a-long-password');
    const value = record();
    value.decisions = ['happy', 'fear', 'disgust'].map((label, index) => ({
      segmentId: String(index),
      label: label as 'happy' | 'fear' | 'disgust',
      score: 0.9,
      contributors: ['face', 'text'],
      reason: 'agreement',
      experimental: true,
      configVersion: 'fixture',
    }));
    await vault.save(value);
    vault.lock();
    await vault.unlock('a-long-password');
    expect((await vault.list())[0].decisions).toEqual(value.decisions);
  });
  it('rejects writes from a different tab holding a replaced vault key', async () => {
    const oldTab = new ConversationVault();
    await oldTab.create('a-long-password');
    const newTab = new ConversationVault();
    await newTab.reset();
    await newTab.create('another-password');
    await expect(oldTab.save(record())).rejects.toThrow();
    expect(await newTab.list()).toEqual([]);
  });
  it('stores ciphertext, rejects wrong passwords, unlocks and deletes without touching reports', async () => {
    const vault = new ConversationVault();
    await vault.create('a-long-password');
    const value = record();
    await vault.save(value);
    await expect(vault.unlock('wrong')).rejects.toThrow();
    expect(vault.unlocked).toBe(false);
    await vault.unlock('a-long-password');
    expect(JSON.stringify(await db.conversations.toArray())).not.toContain('Nội dung');
    vault.lock();
    await expect(vault.list()).rejects.toThrow();
    await expect(vault.unlock('wrong')).rejects.toThrow();
    await vault.unlock('a-long-password');
    expect((await vault.list())[0]).toEqual(value);
    await vault.remove(value.id);
    expect(await vault.list()).toEqual([]);
  });
  it('authenticates metadata/ciphertext and prunes expired rows', async () => {
    const vault = new ConversationVault();
    await vault.create('a-long-password');
    const value = record();
    await vault.save(value);
    const row = (await db.conversations.get(value.id))!;
    row.data[0] ^= 1;
    await db.conversations.put(row);
    await expect(vault.list()).rejects.toThrow();
    await db.conversations.put({ ...row, expiresAt: Date.now() - 1 });
    await vault.prune();
    expect(await db.conversations.count()).toBe(0);
  });
  it('does not save after locking, or after resetting the vault', async () => {
    const vault = new ConversationVault();
    await vault.create('a-long-password');
    vault.lock();
    await expect(vault.save(record())).rejects.toThrow();
    await vault.reset();
    expect(await vault.exists()).toBe(false);
    expect(await db.conversations.count()).toBe(0);
  });
});
