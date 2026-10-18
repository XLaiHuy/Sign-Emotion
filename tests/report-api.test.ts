import { describe, expect, it } from 'vitest';
import { createHandler, sha256, type Repository } from '../supabase/functions/_shared/handler';
import {
  CONSENT_VERSION,
  MODEL_VERSION,
  reportSchema,
  type PilotReport,
} from '../src/shared/contracts';

function fixture(): PilotReport {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    consentVersion: CONSENT_VERSION,
    modelVersion: MODEL_VERSION,
    feedback: { usefulness: 4, distraction: 2, comment: 'Thử nghiệm' },
    metrics: {
      durationMs: 6000,
      processedFrames: 30,
      invalidFrames: 2,
      uncertainFrames: 3,
      hapticCount: 1,
      p50Ms: 20,
      p95Ms: 40,
    },
  };
}
function setup() {
  const rows = new Map<string, { report: PilotReport; hash: string }>();
  const deleted = new Map<string, string>();
  let allowed = true;
  const repo: Repository = {
    rateLimit: async () => allowed,
    submit: async (report, hash) => {
      if (deleted.has(report.id)) return 'withdrawn';
      const old = rows.get(report.id);
      if (old)
        return old.hash === hash && JSON.stringify(old.report) === JSON.stringify(report)
          ? 'duplicate'
          : 'conflict';
      rows.set(report.id, { report, hash });
      return 'created';
    },
    withdraw: async (id, hash) => {
      const saved = rows.get(id)?.hash ?? deleted.get(id);
      if (saved && saved !== hash) return false;
      deleted.set(id, hash);
      rows.delete(id);
      return true;
    },
  };
  const submit = createHandler('submit', repo, ['https://signemo.example'], 'salt');
  const withdraw = createHandler('withdraw', repo, ['https://signemo.example'], 'salt');
  const request = (body: unknown, origin = 'https://signemo.example') =>
    new Request('https://api.example', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return {
    submit,
    withdraw,
    request,
    rows,
    limit: () => {
      allowed = false;
    },
  };
}
describe('pilot report endpoint', () => {
  it('is idempotent and refuses another deletion token or changed payload', async () => {
    const s = setup();
    const report = fixture();
    const payload = { report, deletionToken: 'a'.repeat(64) };
    expect((await s.submit(s.request(payload))).status).toBe(201);
    expect((await s.submit(s.request(payload))).status).toBe(200);
    expect(s.rows.size).toBe(1);
    expect((await s.submit(s.request({ ...payload, deletionToken: 'b'.repeat(64) }))).status).toBe(
      409,
    );
    expect(
      (
        await s.submit(
          s.request({
            ...payload,
            report: { ...report, feedback: { ...report.feedback, usefulness: 1 } },
          }),
        )
      ).status,
    ).toBe(409);
  });
  it('withdraws with the right token and blocks queued replay after withdrawal', async () => {
    const s = setup();
    const report = fixture();
    await s.submit(s.request({ report, deletionToken: 'a'.repeat(64) }));
    expect(
      (await s.withdraw(s.request({ reportId: report.id, deletionToken: 'b'.repeat(64) }))).status,
    ).toBe(403);
    expect(s.rows.size).toBe(1);
    expect(
      (await s.withdraw(s.request({ reportId: report.id, deletionToken: 'a'.repeat(64) }))).status,
    ).toBe(200);
    expect(s.rows.size).toBe(0);
    expect((await s.submit(s.request({ report, deletionToken: 'a'.repeat(64) }))).status).toBe(409);
  });
  it('tombstones a report even when the upload has not arrived yet', async () => {
    const s = setup();
    const report = fixture();
    await s.withdraw(s.request({ reportId: report.id, deletionToken: 'a'.repeat(64) }));
    expect((await s.submit(s.request({ report, deletionToken: 'a'.repeat(64) }))).status).toBe(409);
  });
  it('rejects image fields, missing consent, excessive comments and inconsistent metrics', () => {
    const report = fixture();
    expect(reportSchema.safeParse({ ...report, image: 'data:image/png;base64,...' }).success).toBe(
      false,
    );
    expect(reportSchema.safeParse({ ...report, consentVersion: 'old' }).success).toBe(false);
    expect(
      reportSchema.safeParse({
        ...report,
        feedback: { ...report.feedback, comment: 'x'.repeat(1001) },
      }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({ ...report, metrics: { ...report.metrics, invalidFrames: 100 } })
        .success,
    ).toBe(false);
  });
  it('checks origin, size and rate limits', async () => {
    const s = setup();
    expect((await s.submit(s.request({}, 'https://evil.example'))).status).toBe(403);
    expect((await s.submit(s.request({ comment: 'x'.repeat(17000) }))).status).toBe(413);
    s.limit();
    expect((await s.submit(s.request({}))).status).toBe(429);
  });
  it('hashes deletion codes without preserving their plaintext', async () => {
    const hash = await sha256('a'.repeat(64));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe('a'.repeat(64));
  });
});
