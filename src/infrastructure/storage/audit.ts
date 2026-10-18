import { db } from './database';
import type { AuditEvent } from '../../domain/audit';

const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 1000;

export async function saveAuditEvent(event: AuditEvent) {
  await db.transaction('rw', db.auditEvents, async () => {
    await db.auditEvents
      .where('occurredAt')
      .below(Date.now() - RETENTION_MS)
      .delete();
    await db.auditEvents.put(event);
    const excess = (await db.auditEvents.count()) - MAX_EVENTS;
    if (excess > 0) await db.auditEvents.orderBy('occurredAt').limit(excess).delete();
  });
}

export async function readAuditEvents() {
  await pruneAuditEvents();
  return db.auditEvents.orderBy('occurredAt').reverse().limit(MAX_EVENTS).toArray();
}

export async function pruneAuditEvents(now = Date.now()) {
  await db.auditEvents
    .where('occurredAt')
    .below(now - RETENTION_MS)
    .delete();
  const excess = (await db.auditEvents.count()) - MAX_EVENTS;
  if (excess > 0) await db.auditEvents.orderBy('occurredAt').limit(excess).delete();
}

export async function clearAuditEvents() {
  await db.auditEvents.clear();
}
