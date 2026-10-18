import { z } from 'zod';
import { expressions } from '../../shared/contracts';
import type { ConversationRecord } from '../../domain/conversation';
import { db } from './database';

const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
const ITERATIONS = 600_000;
export interface Sealed {
  iv: number[];
  data: number[];
}
export interface VaultMetadata {
  id: 'primary';
  version: 1;
  salt: number[];
  iterations: number;
  wrapped: Sealed;
}
export interface EncryptedConversation extends Sealed {
  id: string;
  expiresAt: number;
}
const encoder = new TextEncoder();
async function passwordKey(password: string, salt: Uint8Array, iterations: number) {
  const input = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    input,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
async function seal(key: CryptoKey, bytes: Uint8Array, context: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    key,
    new Uint8Array(bytes),
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(data)) };
}
async function open(key: CryptoKey, sealed: Sealed, context: string) {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(sealed.iv), additionalData: encoder.encode(context) },
    key,
    new Uint8Array(sealed.data),
  );
}
const label = z.enum(expressions);
const recordSchema = z
  .object({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    segments: z
      .array(
        z
          .object({
            id: z.string(),
            startMs: z.number().finite(),
            endMs: z.number().finite(),
            text: z.string().max(10000),
            rawText: z.string().max(10000).optional(),
            revision: z.number().int().min(1).max(10).optional(),
            modelVersion: z.string(),
            processingMs: z.number().finite(),
            finalizedAtMs: z.number().finite(),
            boundary: z.enum(['silence', 'limit', 'finish']).optional(),
            utteranceId: z.string().max(200).optional(),
          })
          .strict(),
      )
      .max(500),
    decisions: z
      .array(
        z
          .object({
            segmentId: z.string(),
            label: label.nullable(),
            score: z.number().min(0).max(1),
            contributors: z.array(z.enum(['face', 'text', 'voice'])),
            reason: z.enum(['agreement', 'missing-evidence', 'conflict', 'low-score']),
            experimental: z.boolean(),
            configVersion: z.string(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

/** Keys remain in memory. Call lock on background, navigation and inactivity. */
export class ConversationVault {
  private key: CryptoKey | null = null;
  private metadataTag: string | null = null;
  private generation = 0;
  get unlocked() {
    return this.key !== null;
  }
  lock() {
    this.generation++;
    this.key = null;
    this.metadataTag = null;
  }
  async exists() {
    return !!(await db.vault.get('primary'));
  }
  async create(password: string) {
    if (password.length < 10) throw new Error('Dùng mật khẩu từ 10 ký tự.');
    const generation = this.generation;
    if (await this.exists()) throw new Error('Kho đã tồn tại. Hãy mở khóa hoặc xóa kho cũ.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrapping = await passwordKey(password, salt, ITERATIONS);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await seal(wrapping, bytes, 'signemo-vault-v1');
    const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
    bytes.fill(0);
    const metadata: VaultMetadata = {
      id: 'primary',
      version: 1,
      salt: Array.from(salt),
      iterations: ITERATIONS,
      wrapped,
    };
    await db.vault.add(metadata);
    if (generation === this.generation) {
      this.key = key;
      this.metadataTag = JSON.stringify(metadata);
    }
  }
  async unlock(password: string) {
    this.lock();
    const generation = this.generation;
    const meta = await db.vault.get('primary');
    if (!meta || meta.version !== 1 || meta.iterations !== ITERATIONS)
      throw new Error('Kho chưa có hoặc phiên bản chưa hỗ trợ.');
    try {
      const wrapping = await passwordKey(password, new Uint8Array(meta.salt), meta.iterations);
      const bytes = new Uint8Array(await open(wrapping, meta.wrapped, 'signemo-vault-v1'));
      const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
        'encrypt',
        'decrypt',
      ]);
      bytes.fill(0);
      if (generation === this.generation) {
        this.key = key;
        this.metadataTag = JSON.stringify(meta);
      }
    } catch {
      throw new Error('Mật khẩu không đúng hoặc kho đã hỏng.');
    }
    await this.prune();
  }
  async prune(now = Date.now()) {
    await db.conversations.where('expiresAt').belowOrEqual(now).delete();
  }
  async save(record: ConversationRecord) {
    const key = this.key;
    const tag = this.metadataTag;
    const generation = this.generation;
    if (!key) throw new Error('Kho đang khóa. Phiên này chưa được lưu.');
    const parsed = recordSchema.parse(record);
    const expiresAt = Date.parse(parsed.createdAt) + DAYS_30;
    if (expiresAt <= Date.now()) throw new Error('Phiên đã hết thời hạn lưu.');
    const sealed = await seal(
      key,
      encoder.encode(JSON.stringify(parsed)),
      `signemo-record-v1:${parsed.id}:${expiresAt}`,
    );
    if (generation !== this.generation) throw new Error('Kho đã khóa trong lúc lưu.');
    await db.transaction('rw', db.vault, db.conversations, async () => {
      if (JSON.stringify(await db.vault.get('primary')) !== tag || generation !== this.generation)
        throw new Error('Kho đã thay đổi.');
      await db.conversations.put({ id: parsed.id, expiresAt, ...sealed });
    });
  }
  async list(): Promise<ConversationRecord[]> {
    const key = this.key;
    const generation = this.generation;
    if (!key) throw new Error('Mở khóa để xem lịch sử.');
    await this.prune();
    const records = await Promise.all(
      (await db.conversations.toArray()).map(async (row) => {
        const bytes = await open(key, row, `signemo-record-v1:${row.id}:${row.expiresAt}`);
        const record = recordSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
        if (record.id !== row.id) throw new Error('Bản ghi không hợp lệ.');
        return record;
      }),
    );
    if (generation !== this.generation) return [];
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async remove(id: string) {
    if (!this.key) throw new Error('Mở khóa trước khi xóa phiên.');
    await db.conversations.delete(id);
  }
  async reset() {
    this.lock();
    await db.transaction('rw', db.vault, db.conversations, async () => {
      await db.vault.clear();
      await db.conversations.clear();
    });
  }
}
