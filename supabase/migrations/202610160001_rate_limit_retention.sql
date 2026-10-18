-- Keep the existing report API, grants and tombstones. Only shorten bucket retention.
create or replace function public.consume_rate_limit(bucket_key text, action_name text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare current_count integer;
begin
  if action_name not in ('submit','withdraw') then return false; end if;
  delete from rate_limits where hour <= now() - interval '24 hours';
  insert into rate_limits(bucket,action,hour) values(bucket_key,action_name,date_trunc('hour',now()))
  on conflict (bucket,action,hour) do update set count = rate_limits.count+1 returning count into current_count;
  return current_count <= 60;
end;
$$;
