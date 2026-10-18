import Dexie from 'dexie';
import { expect, it, vi } from 'vitest';
it('upgrades v1 without uploading historical local consent and removes withdrawn payloads', async () => {
  vi.resetModules();
  await Dexie.delete('signemo-v1');
  const old = new Dexie('signemo-v1');
  old.version(1).stores({ preferences: 'key', reports: 'id,state' });
  await old.table('preferences').put({
    key: 'settings',
    value: { threshold: 0.65, dwellMs: 500, cooldownMs: 3000, haptics: false },
  });
  await old.table('reports').bulkPut([
    {
      id: 'local',
      state: 'queued',
      report: { createdAt: '2026-10-11', feedback: { comment: 'private' } },
      deletionToken: 'secret',
    },
    {
      id: 'withdraw',
      state: 'withdrawing',
      report: { feedback: { comment: 'erase' } },
      deletionToken: 'secret',
    },
  ]);
  old.close();
  const { db, loadSettings } = await import('../src/infrastructure/storage/database');
  await db.open();
  expect((await db.reports.get('local'))?.state).toBe('local');
  expect((await db.reports.get('local'))?.deliveryConsent).toBe('local-only');
  expect((await db.reports.get('withdraw'))?.state).toBe('withdrawing');
  expect((await db.reports.get('withdraw'))?.report).toBeUndefined();
  expect((await loadSettings()).hapticMode).toBe('off');
  expect((await loadSettings()).cameraMirror).toBe('auto');
  expect((await loadSettings()).threshold).toBe(0.55);
  const { saveSettings } = await import('../src/infrastructure/storage/database');
  await saveSettings({ ...(await loadSettings()), threshold: 0.65 });
  expect((await loadSettings()).threshold).toBe(0.65);
  db.close();
  await Dexie.delete('signemo-v1');
});

it('adds the encrypted vault without changing existing v2 upload permissions', async () => {
  vi.resetModules();
  await Dexie.delete('signemo-v1');
  const old = new Dexie('signemo-v1');
  old.version(2).stores({ preferences: 'key', reports: 'id,state' });
  const allowed = {
    id: 'allowed',
    state: 'queued',
    deliveryConsent: 'pilot-upload',
    destination: 'https://example.supabase.co',
    consentedAt: '2026-10-11',
    deletionToken: 'token',
  };
  const local = {
    id: 'local',
    state: 'local',
    deliveryConsent: 'local-only',
    deletionToken: 'token',
  };
  await old.table('reports').bulkPut([allowed, local]);
  old.close();
  const { db } = await import('../src/infrastructure/storage/database');
  await db.open();
  expect(await db.reports.get('allowed')).toEqual(allowed);
  expect(await db.reports.get('local')).toEqual(local);
  expect(await db.vault.count()).toBe(0);
  expect(await db.conversations.count()).toBe(0);
  db.close();
  await Dexie.delete('signemo-v1');
});
