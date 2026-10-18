create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.pilot_reports (
  id uuid primary key,
  created_at timestamptz not null,
  received_at timestamptz not null default now(),
  consent_version text not null check (consent_version = 'pilot-v1-2026-10'),
  model_version text not null check (length(model_version) between 1 and 80),
  metrics jsonb not null,
  deletion_token_hash text not null check (deletion_token_hash ~ '^[a-f0-9]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$')
);
create table public.feedback (
  report_id uuid primary key references public.pilot_reports(id) on delete cascade,
  usefulness smallint not null check (usefulness between 1 and 5),
  distraction smallint not null check (distraction between 1 and 5),
  comment text not null default '' check (length(comment) <= 1000)
);
create table public.report_tombstones (
  id uuid primary key,
  deletion_token_hash text not null check (deletion_token_hash ~ '^[a-f0-9]{64}$'),
  withdrawn_at timestamptz not null default now()
);
create table public.rate_limits (
  bucket text not null, action text not null, hour timestamptz not null,
  count integer not null default 1,
  primary key (bucket, action, hour)
);
create index pilot_reports_received_at on public.pilot_reports(received_at desc);
alter table public.admin_users enable row level security;
alter table public.pilot_reports enable row level security;
alter table public.feedback enable row level security;
alter table public.report_tombstones enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.admin_users, public.pilot_reports, public.feedback, public.report_tombstones, public.rate_limits from anon, authenticated;
grant select on public.admin_users, public.pilot_reports, public.feedback to authenticated;
grant all on public.admin_users, public.pilot_reports, public.feedback, public.report_tombstones, public.rate_limits to service_role;

create policy own_admin_entry on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
create policy admin_read_reports on public.pilot_reports for select to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy admin_read_feedback on public.feedback for select to authenticated using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create function public.consume_rate_limit(bucket_key text, action_name text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare current_count integer;
begin
  if action_name not in ('submit','withdraw') then return false; end if;
  delete from rate_limits where hour < now() - interval '2 days';
  insert into rate_limits(bucket,action,hour) values(bucket_key,action_name,date_trunc('hour',now()))
  on conflict (bucket,action,hour) do update set count = rate_limits.count+1 returning count into current_count;
  return current_count <= 60;
end;
$$;

create function public.submit_pilot_report(report jsonb, token_hash text, payload_hash text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare report_id uuid := (report->>'id')::uuid; existing public.pilot_reports;
begin
  perform pg_advisory_xact_lock(hashtextextended(report_id::text,0));
  if exists(select 1 from report_tombstones where id=report_id) then return 'withdrawn'; end if;
  select * into existing from pilot_reports where id=report_id;
  if found then
    if existing.deletion_token_hash=token_hash and existing.payload_hash=submit_pilot_report.payload_hash then return 'duplicate'; end if;
    return 'conflict';
  end if;
  insert into pilot_reports(id,created_at,consent_version,model_version,metrics,deletion_token_hash,payload_hash)
  values(report_id,(report->>'createdAt')::timestamptz,report->>'consentVersion',report->>'modelVersion',report->'metrics',token_hash,payload_hash);
  insert into feedback(report_id,usefulness,distraction,comment)
  values(report_id,(report->'feedback'->>'usefulness')::smallint,(report->'feedback'->>'distraction')::smallint,report->'feedback'->>'comment');
  return 'created';
end;
$$;

create function public.withdraw_pilot_report(report_id uuid, token_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare existing_hash text;
begin
  perform pg_advisory_xact_lock(hashtextextended(report_id::text,0));
  select deletion_token_hash into existing_hash from report_tombstones where id=report_id;
  if found then return existing_hash=token_hash; end if;
  select deletion_token_hash into existing_hash from pilot_reports where id=report_id;
  if found and existing_hash<>token_hash then return false; end if;
  insert into report_tombstones(id,deletion_token_hash) values(report_id,token_hash);
  delete from pilot_reports where id=report_id;
  return true;
end;
$$;

create function public.admin_delete_report(report_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare token_hash text;
begin
  if not exists(select 1 from admin_users where user_id=auth.uid()) then raise exception 'Forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(report_id::text,0));
  select deletion_token_hash into token_hash from pilot_reports where id=report_id;
  if found then
    insert into report_tombstones(id,deletion_token_hash) values(report_id,token_hash) on conflict do nothing;
    delete from pilot_reports where id=report_id;
  end if;
end;
$$;
revoke all on function public.consume_rate_limit(text,text) from public, anon, authenticated;
revoke all on function public.submit_pilot_report(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.withdraw_pilot_report(uuid,text) from public, anon, authenticated;
revoke all on function public.admin_delete_report(uuid) from public, anon;
grant execute on function public.consume_rate_limit(text,text), public.submit_pilot_report(jsonb,text,text), public.withdraw_pilot_report(uuid,text) to service_role;
grant execute on function public.admin_delete_report(uuid) to authenticated;
