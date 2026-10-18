import { useSyncExternalStore } from 'react';
import {
  auditLevel,
  auditReasonFromName,
  type AuditCode,
  type AuditDetails,
  type AuditEvent,
  type AuditPage,
  type AuditPhase,
  isInterruptedAuditPhase,
} from '../../domain/audit';
import {
  clearAuditEvents,
  pruneAuditEvents,
  readAuditEvents,
  saveAuditEvent,
} from '../storage/audit';

const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 1000;
const MAX_PENDING_WRITES = 128;
const MARKER_KEY = 'signemo.audit.startup';
const listeners = new Set<() => void>();
let entries: AuditEvent[] = [];
let bootId = createId();
let buildId = 'development';
let sessionId: string | undefined;
let initialized = false;
let startupInterrupted = false;
let storageFailed = false;
let writing = Promise.resolve();
let pendingWrites = 0;
let pruneTimer: ReturnType<typeof setInterval> | undefined;
const lastEvents = new Map<string, number>();
const pages = new Set<AuditPage>([
  'conversation',
  'history',
  'home',
  'practice',
  'feedback',
  'settings',
  'activity',
  'admin',
  'lab',
  'speech-lab',
]);
const phases = new Set<AuditPhase>([
  'preparing-assets',
  'preparing-ai',
  'requesting-permission',
  'connecting',
  'running',
  'ready',
]);
const reasons = new Set([
  'permission-denied',
  'device-missing',
  'device-busy',
  'unsupported-browser',
  'worker-failed',
  'timeout',
  'storage',
  'offline',
  'user-canceled',
  'background',
  'unknown',
]);
const branches = new Set([
  'assets',
  'speech',
  'face',
  'emotion',
  'storage',
  'audio',
  'voice',
  'text',
]);

function createId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function publish() {
  entries = entries
    .filter((event) => event.occurredAt >= Date.now() - RETENTION_MS)
    .slice(0, MAX_EVENTS);
  listeners.forEach((listener) => listener());
}

function sanitizeDetails(details: AuditDetails): AuditDetails {
  const safe: { -readonly [Key in keyof AuditDetails]: AuditDetails[Key] } = {};
  if (details.page && pages.has(details.page)) safe.page = details.page;
  if (details.phase && phases.has(details.phase)) safe.phase = details.phase;
  if (details.reason && reasons.has(details.reason)) safe.reason = details.reason;
  if (details.branch && branches.has(details.branch)) safe.branch = details.branch;
  if (typeof details.percent === 'number' && Number.isFinite(details.percent))
    safe.percent = Math.max(0, Math.min(100, Math.floor(details.percent)));
  if (typeof details.durationMs === 'number' && Number.isFinite(details.durationMs))
    safe.durationMs = Math.max(0, Math.min(3_600_000, Math.floor(details.durationMs)));
  if (typeof details.rtf === 'number' && Number.isFinite(details.rtf))
    safe.rtf = Math.round(Math.max(0, Math.min(20, details.rtf)) * 100) / 100;
  if (typeof details.count === 'number' && Number.isFinite(details.count))
    safe.count = Math.max(0, Math.min(1_000_000, Math.floor(details.count)));
  if (typeof details.enabled === 'boolean') safe.enabled = details.enabled;
  if (
    details.modelProfile &&
    [
      'phowhisper-tiny-q8',
      'whisper-tiny-q8',
      'gipformer1.5-int8',
      'emotieff-b0',
      'emotieff-b2-research',
      'tone-mlp-research',
      'emotion2vec-base-int8-research',
      'emotion2vec-base-fp32-gpu-research',
      'moonshine-streaming-tiny-vi-research',
    ].includes(details.modelProfile)
  )
    safe.modelProfile = details.modelProfile;
  return safe;
}

export function emitAudit(code: AuditCode, details: AuditDetails = {}, forSession = sessionId) {
  const now = Date.now();
  const safeDetails = sanitizeDetails(details);
  const dedupeKey = `${code}:${JSON.stringify(safeDetails)}`;
  const last = lastEvents.get(dedupeKey) ?? 0;
  if (now - last < 1500) return;
  lastEvents.set(dedupeKey, now);
  const event: AuditEvent = {
    id: createId(),
    occurredAt: now,
    level: auditLevel(code),
    code,
    bootId,
    sessionId: forSession,
    buildId,
    details: safeDetails,
  };
  entries = [event, ...entries].slice(0, MAX_EVENTS);
  publish();
  if (!storageFailed && pendingWrites < MAX_PENDING_WRITES) {
    pendingWrites++;
    writing = writing
      .then(() => saveAuditEvent(event))
      .catch(() => {
        storageFailed = true;
        const warning: AuditEvent = {
          ...event,
          id: createId(),
          occurredAt: Date.now(),
          code: 'log-storage-unavailable',
          level: 'warning',
          details: { branch: 'storage' },
        };
        entries = [warning, ...entries].slice(0, MAX_EVENTS);
        publish();
      })
      .finally(() => {
        pendingWrites = Math.max(0, pendingWrites - 1);
      });
  }
  return event;
}

export function beginAuditSession() {
  sessionId = createId();
  return sessionId;
}

export function endAuditSession() {
  sessionId = undefined;
}

export function setAuditPhase(phase: AuditPhase) {
  try {
    if (phase === 'ready') sessionStorage.removeItem(MARKER_KEY);
    else
      sessionStorage.setItem(
        MARKER_KEY,
        JSON.stringify({ bootId, phase, occurredAt: Date.now(), sessionId }),
      );
  } catch {
    // Startup recovery is best effort when session storage is disabled.
  }
}

export function initializeAudit(currentBuildId: string) {
  if (initialized) return;
  initialized = true;
  buildId = currentBuildId;
  let interrupted = false;
  let discarded = false;
  try {
    const marker = sessionStorage.getItem(MARKER_KEY);
    if (marker) {
      const previous = JSON.parse(marker) as {
        phase?: AuditPhase;
        occurredAt?: number;
        sessionId?: string;
      };
      interrupted = isInterruptedAuditPhase(previous.phase, Boolean(previous.sessionId));
    }
    discarded = Boolean((document as Document & { wasDiscarded?: boolean }).wasDiscarded);
  } catch {
    interrupted = false;
  }
  startupInterrupted = interrupted || discarded;
  setAuditPhase('preparing-assets');
  if (interrupted || discarded) emitAudit('startup-interrupted', { reason: 'unknown' });
  emitAudit('app-opened', { reason: interrupted || discarded ? 'unknown' : undefined });
  const onError = (event: ErrorEvent) => {
    const reason = auditReasonFromName(event.error?.name ?? '');
    emitAudit('app-error', { reason });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = auditReasonFromName(
      event.reason instanceof DOMException || event.reason instanceof Error
        ? event.reason.name
        : '',
    );
    emitAudit('app-error', { reason });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  void readAuditEvents()
    .then((stored) => {
      entries = [...entries, ...stored]
        .filter(
          (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
        )
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, MAX_EVENTS);
      publish();
    })
    .catch(() => {
      storageFailed = true;
      emitAudit('log-storage-unavailable', { branch: 'storage' });
    });
  pruneTimer = setInterval(
    () => {
      void pruneAuditEvents()
        .then(() => {
          const previousLength = entries.length;
          entries = entries.filter((event) => event.occurredAt >= Date.now() - RETENTION_MS);
          if (entries.length !== previousLength) publish();
        })
        .catch(() => {
          if (storageFailed) return;
          storageFailed = true;
          emitAudit('log-storage-unavailable', { branch: 'storage' });
        });
    },
    60 * 60 * 1000,
  );
}

export function startupWasInterrupted() {
  return startupInterrupted;
}

export function recordPageOpened(page: AuditPage) {
  emitAudit('page-opened', { page });
}

export function reportPermissionFailure(name: string) {
  const reason = auditReasonFromName(name);
  emitAudit('permission-failed', { reason });
}

export function useAuditEvents() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => entries,
    () => [],
  );
}

export async function removeAllAuditEvents() {
  entries = [];
  publish();
  try {
    writing = writing.then(clearAuditEvents);
    await writing;
  } catch {
    storageFailed = true;
    emitAudit('log-storage-unavailable', { branch: 'storage' });
  }
}

export async function exportAuditEvents() {
  await writing;
  return [...entries];
}

export function auditLoggerState() {
  return {
    bootId,
    buildId,
    eventCount: entries.length,
    storageFailed,
    hasPruneTimer: Boolean(pruneTimer),
  };
}
