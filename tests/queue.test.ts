import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueuedReport } from '../src/infrastructure/storage/database';
import { CONSENT_VERSION, MODEL_VERSION } from '../src/shared/contracts';
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
let store: typeof import('../src/infrastructure/storage/database');
let api: typeof import('../src/infrastructure/backend/reports');
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  store = await import('../src/infrastructure/storage/database');
  await store.db.reports.clear();
  api = await import('../src/infrastructure/backend/reports');
  fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(async () => {
  await store.db.reports.clear();
  store.db.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function queue(): Promise<QueuedReport> {
  const id = crypto.randomUUID();
  const item: QueuedReport = {
    id,
    state: 'queued',
    deliveryConsent: 'pilot-upload',
    destination: 'https://example.supabase.co',
    consentedAt: new Date().toISOString(),
    deletionToken: 'a'.repeat(64),
    report: {
      id,
      consentVersion: CONSENT_VERSION,
      modelVersion: MODEL_VERSION,
      createdAt: new Date().toISOString(),
      feedback: { usefulness: 3, distraction: 1, comment: '' },
      metrics: {
        durationMs: 1000,
        processedFrames: 5,
        invalidFrames: 1,
        uncertainFrames: 1,
        hapticCount: 0,
        p50Ms: 10,
        p95Ms: 20,
      },
    },
  };
  await store.db.reports.put(item);
  return item;
}
describe('persistent report queue', () => {
  it('retains a failed upload and retries the same id and deletion token', async () => {
    const item = await queue();
    fetcher.mockRejectedValueOnce(new Error('Offline'));
    await api.syncReports();
    expect((await store.db.reports.get(item.id))?.state).toBe('queued');
    await api.syncReports();
    expect((await store.db.reports.get(item.id))?.state).toBe('sent');
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  });
  it('sends nothing while offline and coalesces simultaneous sync attempts', async () => {
    await queue();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await api.syncReports();
    expect(fetcher).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await Promise.all([api.syncReports(), api.syncReports(), api.syncReports()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('waits for an in-flight upload before withdrawing', async () => {
    const item = await queue();
    let complete!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    const upload = api.syncReports();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const withdrawal = api.withdrawReport(item);
    complete(new Response('{}', { status: 201 }));
    await upload;
    await withdrawal;
    expect(fetcher.mock.calls[1][0]).toContain('withdraw-report');
    expect((await store.db.reports.get(item.id))?.state).toBe('withdrawn');
  });
  it('stops retrying a report already withdrawn on the server', async () => {
    const item = await queue();
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'withdrawn' }), { status: 409 }),
    );
    await api.syncReports();
    expect((await store.db.reports.get(item.id))?.state).toBe('withdrawn');
    await api.syncReports();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('never uploads local-only or legacy unproven consent and binds uploads to destination', async () => {
    const local = await queue();
    await store.db.reports.update(local.id, { state: 'local', deliveryConsent: 'local-only' });
    const legacy = await queue();
    await store.db.reports.update(legacy.id, {
      deliveryConsent: undefined,
      consentedAt: undefined,
    });
    const changed = await queue();
    await store.db.reports.update(changed.id, { destination: 'https://different.supabase.co' });
    await api.syncReports();
    expect(fetcher).not.toHaveBeenCalled();
    expect((await store.db.reports.get(legacy.id))?.state).toBe('local');
    expect((await store.db.reports.get(changed.id))?.error).toContain('Đích nhận');
  });
  it('erases local payload immediately during offline withdrawal and keeps only receipt', async () => {
    const item = await queue();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await api.withdrawReport(item);
    const row = await store.db.reports.get(item.id);
    expect(row?.state).toBe('withdrawing');
    expect(row?.report).toBeUndefined();
    expect(row?.deletionToken).toBe(item.deletionToken);
    expect(fetcher).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await api.syncReports();
    expect((await store.db.reports.get(item.id))?.state).toBe('withdrawn');
  });
  it('requires explicit new upload consent for local data and deletes local-only data without networking', async () => {
    const item = await queue();
    await store.db.reports.update(item.id, { state: 'local', deliveryConsent: 'local-only' });
    await api.allowReportUpload({ ...item, state: 'local' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await store.db.reports.get(item.id)).toBeUndefined();
    const local = await queue();
    await store.db.reports.update(local.id, { state: 'local' });
    fetcher.mockClear();
    await api.deleteLocalReport(local.id);
    expect(await store.db.reports.get(local.id)).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not overwrite a known deletion receipt with a mistyped code', async () => {
    const item = await queue();
    await api.syncReports();
    fetcher.mockClear();
    await expect(api.withdrawByCode(item.id, 'b'.repeat(64))).rejects.toThrow('không khớp');
    expect((await store.db.reports.get(item.id))?.deletionToken).toBe(item.deletionToken);
    expect((await store.db.reports.get(item.id))?.report).toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
