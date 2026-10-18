import Dexie, { type Table } from 'dexie';
import {
  defaultSettings,
  settingsSchema,
  type Settings,
  type PilotReport,
} from '../../shared/contracts';
import type { EncryptedConversation, VaultMetadata } from './vault';
import type { AuditEvent } from '../../domain/audit';

export interface QueuedReport {
  id: string;
  report?: PilotReport;
  createdAt?: string;
  deletionToken: string;
  state: 'local' | 'queued' | 'sent' | 'withdrawing' | 'withdrawn';
  deliveryConsent?: 'local-only' | 'pilot-upload';
  destination?: string;
  consentedAt?: string;
  error?: string;
}
export function migrateReport(row: QueuedReport) {
  row.createdAt ??= row.report?.createdAt;
  if (row.state === 'queued') {
    row.state = 'local';
    row.deliveryConsent = 'local-only';
    delete row.destination;
    delete row.consentedAt;
    delete row.error;
  }
  if (row.state === 'withdrawing' || row.state === 'withdrawn') delete row.report;
  return row;
}
class SignEmoDB extends Dexie {
  preferences!: Table<{ key: string; value: unknown }, string>;
  reports!: Table<QueuedReport, string>;
  vault!: Table<VaultMetadata, string>;
  conversations!: Table<EncryptedConversation, string>;
  auditEvents!: Table<AuditEvent, string>;
  constructor() {
    super('signemo-v1');
    this.version(1).stores({ preferences: 'key', reports: 'id,state' });
    this.version(2)
      .stores({ preferences: 'key', reports: 'id,state' })
      .upgrade(async (tx) => {
        await tx.table('reports').toCollection().modify(migrateReport);
        await tx
          .table('preferences')
          .where('key')
          .equals('settings')
          .modify((row: { value: Settings }) => {
            row.value.hapticMode = row.value.haptics ? 'auto' : 'off';
          });
      });
    this.version(3).stores({
      preferences: 'key',
      reports: 'id,state',
      vault: 'id',
      conversations: 'id,expiresAt',
    });
    this.version(4)
      .stores({
        preferences: 'key',
        reports: 'id,state',
        vault: 'id',
        conversations: 'id,expiresAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('preferences')
          .where('key')
          .equals('settings')
          .modify((row: { value: Settings }) => {
            row.value.soundFeedback ??= true;
          });
      });
    this.version(5).stores({
      preferences: 'key',
      reports: 'id,state',
      vault: 'id',
      conversations: 'id,expiresAt',
      auditEvents: 'id,occurredAt,level,code,bootId,sessionId',
    });
  }
}
export const db = new SignEmoDB();
export async function loadSettings(): Promise<Settings> {
  const stored = await db.preferences.get('settings');
  const parsed = settingsSchema.safeParse(stored?.value);
  const sensitivity = await db.preferences.get('sensitive-demo-v1');
  const settings = parsed.success
    ? {
        ...parsed.data,
        hapticMode: parsed.data.hapticMode ?? (parsed.data.haptics ? 'auto' : 'off'),
      }
    : defaultSettings;
  if (!sensitivity) {
    // Apply the requested demo default once; preserve other custom thresholds.
    if (settings.threshold === 0.65) settings.threshold = defaultSettings.threshold;
    await db.transaction('rw', db.preferences, async () => {
      await db.preferences.put({ key: 'settings', value: settingsSchema.parse(settings) });
      await db.preferences.put({ key: 'sensitive-demo-v1', value: true });
    });
  }
  return settings;
}
export async function saveSettings(value: Settings) {
  await db.preferences.put({ key: 'settings', value: settingsSchema.parse(value) });
}
export function createDeletionToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
}
