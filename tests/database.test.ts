// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { CONSENT_VERSION, MODEL_VERSION } from '../src/shared/contracts';

let db: PGlite;
const owner = '11111111-1111-4111-8111-111111111111';
const outsider = '22222222-2222-4222-8222-222222222222';
const payload = (id: string) => ({
  id,
  createdAt: '2026-10-11T10:00:00.000Z',
  consentVersion: CONSENT_VERSION,
  modelVersion: MODEL_VERSION,
  feedback: { usefulness: 4, distraction: 1, comment: 'Pilot' },
  metrics: {
    durationMs: 1000,
    processedFrames: 5,
    invalidFrames: 0,
    uncertainFrames: 0,
    hapticCount: 0,
    p50Ms: 10,
    p95Ms: 20,
  },
});
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}'),('${outsider}');`);
  await db.exec(await readFile('supabase/migrations/202610110001_signemo.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/202610110002_feedback_consent.sql', 'utf8'));
  await db.exec(
    await readFile('supabase/migrations/202610160001_rate_limit_retention.sql', 'utf8'),
  );
  await db.query('insert into public.admin_users(user_id) values($1)', [owner]);
}, 30_000);
afterAll(async () => {
  await db?.close();
});
describe('PostgreSQL migration and permissions', () => {
  it('prunes rate buckets older than 24 hours on consumption without deleting tombstones', async () => {
    await db.exec(
      "insert into rate_limits(bucket,action,hour,count) values('expired','submit',now()-interval '25 hours',1),('recent','submit',now()-interval '23 hours',1)",
    );
    await db.query("select consume_rate_limit('retention-test','submit')");
    expect(
      (await db.query("select bucket from rate_limits where bucket='expired'")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select bucket from rate_limits where bucket='recent'")).rows,
    ).toHaveLength(1);
  });
  it('atomically saves feedback, deduplicates and protects the deletion token', async () => {
    const id = crypto.randomUUID();
    const report = payload(id);
    const submit = () =>
      db.query<{ result: string }>('select public.submit_pilot_report($1::jsonb,$2,$3) as result', [
        JSON.stringify(report),
        'a'.repeat(64),
        'b'.repeat(64),
      ]);
    expect((await submit()).rows[0].result).toBe('created');
    expect((await submit()).rows[0].result).toBe('duplicate');
    expect(
      (
        await db.query<{ result: boolean }>(
          'select public.withdraw_pilot_report($1,$2) as result',
          [id, 'c'.repeat(64)],
        )
      ).rows[0].result,
    ).toBe(false);
    await db.query('select public.withdraw_pilot_report($1,$2)', [id, 'a'.repeat(64)]);
    expect((await db.query('select * from feedback where report_id=$1', [id])).rows).toHaveLength(
      0,
    );
    expect((await submit()).rows[0].result).toBe('withdrawn');
  });
  it('enforces RLS for non-admin and allows only the allowlisted owner to read', async () => {
    const id = crypto.randomUUID();
    await db.query('select public.submit_pilot_report($1::jsonb,$2,$3)', [
      JSON.stringify(payload(id)),
      'a'.repeat(64),
      'b'.repeat(64),
    ]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${outsider}';`);
    expect((await db.query('select id from pilot_reports')).rows).toHaveLength(0);
    expect((await db.query('select * from admin_users')).rows).toHaveLength(0);
    await expect(db.query('select public.admin_delete_report($1)', [id])).rejects.toThrow(
      'Forbidden',
    );
    await expect(db.query('insert into admin_users values($1)', [outsider])).rejects.toThrow();
    await db.exec(`set request.jwt.claim.sub='${owner}';`);
    expect((await db.query('select id from pilot_reports')).rows.length).toBeGreaterThan(0);
    await db.query('select public.admin_delete_report($1)', [id]);
    await db.exec('reset role;');
    expect(
      (await db.query('select id from report_tombstones where id=$1', [id])).rows,
    ).toHaveLength(1);
  });
  it('denies anonymous reads and writes to every report table and privileged RPC', async () => {
    await db.exec('set role anon;');
    await expect(db.query('select * from pilot_reports')).rejects.toThrow();
    await expect(db.query('select * from feedback')).rejects.toThrow();
    await expect(db.query('select * from report_tombstones')).rejects.toThrow();
    await expect(
      db.query('select public.withdraw_pilot_report($1,$2)', [crypto.randomUUID(), 'a'.repeat(64)]),
    ).rejects.toThrow();
    await db.exec('reset role;');
  });
  it('limits a bucket and action to 60 requests per hour', async () => {
    for (let i = 0; i < 60; i++)
      expect(
        (await db.query<{ ok: boolean }>("select consume_rate_limit('test','submit') as ok"))
          .rows[0].ok,
      ).toBe(true);
    expect(
      (await db.query<{ ok: boolean }>("select consume_rate_limit('test','submit') as ok")).rows[0]
        .ok,
    ).toBe(false);
  });
});
