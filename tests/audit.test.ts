import { afterEach, expect, it } from 'vitest';
import {
  auditLevel,
  auditMessage,
  isInterruptedAuditPhase,
  type AuditEvent,
} from '../src/domain/audit';
import { emitAudit, exportAuditEvents } from '../src/infrastructure/audit/log';
import { clearAuditEvents, pruneAuditEvents } from '../src/infrastructure/storage/audit';
import { db } from '../src/infrastructure/storage/database';

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: crypto.randomUUID(),
    occurredAt: Date.now(),
    level: 'info',
    code: 'app-opened',
    bootId: 'test-boot',
    buildId: 'test-build',
    details: {},
    ...overrides,
  };
}

afterEach(async () => {
  await clearAuditEvents();
});

it('keeps only recent activity and enforces the 1,000-event cap', async () => {
  const now = Date.now();
  await db.auditEvents.bulkPut([
    event({ id: 'expired', occurredAt: now - 24 * 60 * 60 * 1000 - 1 }),
    ...Array.from({ length: 1001 }, (_, index) =>
      event({ id: `recent-${index}`, occurredAt: now - 1000 + index }),
    ),
  ]);

  await pruneAuditEvents(now);

  expect(await db.auditEvents.count()).toBe(1000);
  expect(await db.auditEvents.get('expired')).toBeUndefined();
  expect(await db.auditEvents.get('recent-0')).toBeUndefined();
  expect(await db.auditEvents.get('recent-1000')).toBeDefined();
});

it('uses fixed Vietnamese messages and does not store unapproved detail fields', async () => {
  expect(
    auditMessage({ code: 'permission-failed', details: { reason: 'permission-denied' } }),
  ).toContain('Hãy cho phép cả hai');
  expect(
    auditMessage({
      code: 'asr-model-ready',
      details: { modelProfile: 'phowhisper-tiny-q8' },
    }),
  ).toContain('PhoWhisper-tiny');
  expect(
    auditMessage({
      code: 'asr-model-ready',
      details: { modelProfile: 'whisper-tiny-q8' },
    }),
  ).toContain('Whisper tiny dự phòng');
  expect(auditLevel('report-send-failed')).toBe('error');

  const recorded = emitAudit('page-opened', {
    page: 'settings',
    reason: 'unknown',
    comment: 'private text',
  } as never);
  expect(recorded?.details).toEqual({ page: 'settings', reason: 'unknown' });
  const modelEvent = emitAudit('asr-model-ready', {
    branch: 'speech',
    modelProfile: 'phowhisper-tiny-q8',
    text: 'must not be stored',
  } as never);
  expect(modelEvent?.details).toEqual({ branch: 'speech', modelProfile: 'phowhisper-tiny-q8' });
  await exportAuditEvents();
  const stored = await db.auditEvents.get(recorded!.id);
  expect(stored?.details).toEqual({ page: 'settings', reason: 'unknown' });
  expect(JSON.stringify(stored)).not.toContain('private text');
});

it('recognizes an active session even when its latest startup phase was overwritten', () => {
  expect(isInterruptedAuditPhase('preparing-ai')).toBe(false);
  expect(isInterruptedAuditPhase('preparing-ai', true)).toBe(true);
  expect(isInterruptedAuditPhase('running')).toBe(true);
});
