import { createClient } from '@supabase/supabase-js';
import { db, type QueuedReport } from '../storage/database';
import { CONSENT_VERSION, reportSchema, withdrawalSchema } from '../../shared/contracts';
import { createDeletionToken } from '../storage/database';
import { auditReasonFromName } from '../../domain/audit';
import { emitAudit } from '../audit/log';

const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const backendConfigured = Boolean(url && key);
export const backendDestination = backendConfigured ? url! : '';
export const supabase = backendConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
let syncInFlight: Promise<void> | null = null;
async function request(path: string, body: unknown, destination = backendDestination) {
  if (!backendConfigured)
    throw new Error('Chưa kết nối máy chủ. Báo cáo vẫn được giữ trên thiết bị.');
  if (destination !== backendDestination)
    throw new Error(
      'Đích nhận đã đổi hoặc chưa xác minh. Cần cấu hình lại đúng project để rút lại; đồng ý lại để gửi sang đích mới.',
    );
  const response = await fetch(`${url}/functions/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key! },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (response.status === 409 && path === 'submit-report') {
    const body = await response.json().catch(() => null);
    if (body?.error === 'withdrawn') return 'withdrawn';
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'Máy chủ đang bận. Hãy thử lại sau.'
        : `Chưa gửi được báo cáo (${response.status}).`,
    );
  return 'ok';
}
export async function syncReports() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    if (!backendConfigured || !navigator.onLine) return;
    const rows = await db.reports.where('state').anyOf('queued', 'withdrawing').toArray();
    for (const snapshot of rows) {
      const item = await db.reports.get(snapshot.id);
      if (!item || !['queued', 'withdrawing'].includes(item.state)) continue;
      try {
        if (item.state === 'withdrawing') {
          await request(
            'withdraw-report',
            { reportId: item.id, deletionToken: item.deletionToken },
            item.destination ?? '',
          );
          await db.reports.update(item.id, {
            state: 'withdrawn',
            report: undefined,
            error: undefined,
          });
          emitAudit('report-withdrawn');
        } else {
          if (
            item.deliveryConsent !== 'pilot-upload' ||
            !item.consentedAt ||
            item.report?.consentVersion !== CONSENT_VERSION
          ) {
            await db.reports.update(item.id, {
              state: 'local',
              deliveryConsent: 'local-only',
              error: undefined,
            });
            continue;
          }
          if (item.destination !== backendDestination) {
            await db.reports.update(item.id, {
              error: 'Đích nhận đã đổi. Phản hồi chưa được gửi; cần đồng ý lại.',
            });
            continue;
          }
          const status = await request('submit-report', {
            report: item.report,
            deletionToken: item.deletionToken,
          });
          await db.reports.update(item.id, {
            state: status === 'withdrawn' ? 'withdrawn' : 'sent',
            ...(status === 'withdrawn' ? { report: undefined } : {}),
            error: undefined,
          });
          if (status === 'withdrawn') emitAudit('report-withdrawn');
          else emitAudit('report-sent');
        }
      } catch (error) {
        await db.reports.update(item.id, {
          error: error instanceof Error ? error.message : 'Lỗi kết nối',
        });
        const reason = auditReasonFromName(
          error instanceof DOMException || error instanceof Error ? error.name : '',
        );
        emitAudit(item.state === 'withdrawing' ? 'report-withdraw-failed' : 'report-send-failed', {
          reason,
        });
      }
    }
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}
export async function withdrawReport(item: QueuedReport) {
  // Serialize with any pending upload: an upload must never resurrect a withdrawn report.
  if (syncInFlight) await syncInFlight;
  const current = await db.reports.get(item.id);
  if (!current) return;
  if (current.state === 'local') {
    await db.reports.delete(item.id);
    emitAudit('report-deleted');
    return;
  }
  if (current.state === 'withdrawn') return;
  await db.reports.update(item.id, { state: 'withdrawing', report: undefined, error: undefined });
  emitAudit('report-withdraw-requested');
  await syncReports();
}
export async function deleteLocalReport(id: string) {
  if (syncInFlight) await syncInFlight;
  const item = await db.reports.get(id);
  if (!item) return;
  if (item.state === 'queued' || item.state === 'withdrawing')
    throw new Error('Hãy rút lại bản đang chờ xử lý trước để không mất mã xóa.');
  await db.reports.delete(id);
  emitAudit('report-deleted');
}
export async function allowReportUpload(item: QueuedReport) {
  if (!backendConfigured || !item.report || item.state !== 'local')
    throw new Error('Chưa thể gửi phản hồi này');
  const id = crypto.randomUUID(),
    report = reportSchema.parse({ ...item.report, id, consentVersion: CONSENT_VERSION });
  await db.transaction('rw', db.reports, async () => {
    await db.reports.put({
      id,
      report,
      createdAt: report.createdAt,
      deletionToken: createDeletionToken(),
      state: 'queued',
      deliveryConsent: 'pilot-upload',
      destination: backendDestination,
      consentedAt: new Date().toISOString(),
    });
    await db.reports.delete(item.id);
  });
  await syncReports();
}
export async function withdrawByCode(reportId: string, deletionToken: string) {
  withdrawalSchema.parse({ reportId, deletionToken });
  if (!backendConfigured)
    throw new Error('Cần cấu hình đúng project nhận báo cáo trước khi rút lại bằng mã.');
  if (syncInFlight) await syncInFlight;
  const existing = await db.reports.get(reportId);
  if (existing && existing.deletionToken !== deletionToken)
    throw new Error('Mã xóa không khớp bản lưu trên thiết bị.');
  if (existing?.destination && existing.destination !== backendDestination)
    throw new Error('Cần cấu hình đúng đích nhận đã lưu để rút lại');
  await db.reports.put({
    id: reportId,
    deletionToken,
    state: 'withdrawing',
    destination: backendDestination,
    createdAt: existing?.createdAt,
  });
  emitAudit('report-withdraw-requested');
  await syncReports();
  if ((await db.reports.get(reportId))?.state === 'withdrawing' && navigator.onLine)
    throw new Error('Đang chờ rút lại. Kiểm tra đích nhận, mã xóa và kết nối.');
}
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
