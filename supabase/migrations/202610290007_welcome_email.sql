-- Requested welcome-offer emails only. This table is not a marketing subscription list.
create table if not exists public.welcome_requests (
 id uuid primary key, email text not null, ip_hash text not null, policy_version text not null,
 requested_at timestamptz not null default now(), status text not null default 'pending'
 check(status in ('pending','sending','provider_accepted','mocked','uncertain')),
 provider_id text
);
create index if not exists welcome_email_time on public.welcome_requests(email,requested_at);
create index if not exists welcome_ip_time on public.welcome_requests(ip_hash,requested_at);
alter table public.welcome_requests enable row level security;
revoke all on public.welcome_requests from anon,authenticated;
create or replace function public.welcome_command(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.welcome_requests; result jsonb;
begin
 if p_action='reserve' then
  perform pg_advisory_xact_lock(hashtextextended('welcome-ip:'||(p_data->>'ipHash'),0));
  perform pg_advisory_xact_lock(hashtextextended('welcome-email:'||(p_data->>'email'),0));
  delete from public.welcome_requests where requested_at<now()-interval '90 days';
  if exists(select 1 from public.welcome_requests where email=p_data->>'email' and requested_at>now()-interval '30 days') then return jsonb_build_object('kind','duplicate');end if;
  if (select count(*) from public.welcome_requests where ip_hash=p_data->>'ipHash' and requested_at>now()-interval '1 hour')>=3 then return jsonb_build_object('kind','limited');end if;
  insert into public.welcome_requests(id,email,ip_hash,policy_version) values((p_data->>'id')::uuid,p_data->>'email',p_data->>'ipHash',p_data->>'policyVersion');
  return jsonb_build_object('kind','accepted','id',p_data->>'id');
 elsif p_action='claim' then
  update public.welcome_requests set status='sending' where id=(p_data->>'id')::uuid and status='pending' returning * into item;
  if not found then return null;end if;
  return jsonb_build_object('id',item.id,'email',item.email);
 elsif p_action='finish' then
  if p_data->>'status' not in ('provider_accepted','mocked','uncertain') then raise exception 'invalid status';end if;
  update public.welcome_requests set status=p_data->>'status',provider_id=p_data->>'providerId' where id=(p_data->>'id')::uuid and status='sending';return '{}'::jsonb;
 end if;
 raise exception 'unknown welcome action';
end $$;
revoke all on function public.welcome_command(text,jsonb) from public,anon,authenticated;
grant usage on schema public to service_role;
grant execute on function public.welcome_command(text,jsonb) to service_role;
