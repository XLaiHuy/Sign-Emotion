-- Preserve existing v1 reports while new clients/API only accept explicit v2 upload consent.
alter table public.pilot_reports drop constraint pilot_reports_consent_version_check;
alter table public.pilot_reports add constraint pilot_reports_consent_version_check
  check (consent_version in ('pilot-v1-2026-10','pilot-v2-2026-10'));
