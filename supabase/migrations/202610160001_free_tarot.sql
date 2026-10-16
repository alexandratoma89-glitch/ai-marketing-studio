-- Apply once using Supabase migrations/SQL editor. No public browser access.
create table public.tarot_contacts (
 id uuid primary key default gen_random_uuid(), email text not null unique,
 first_name text not null, created_at timestamptz not null default now()
);
create table public.tarot_requests (
 id uuid primary key, contact_id uuid not null references public.tarot_contacts(id),
 requested_at timestamptz not null default now(), policy_version text not null,
 card jsonb not null, reading jsonb,
 status text not null default 'requested' check(status in ('requested','generating','generated','mocked','provider_accepted','generation_failed','email_failed','delivered','bounced')),
 provider_id text unique, updated_at timestamptz not null default now()
);
create index tarot_requests_contact_time on public.tarot_requests(contact_id,requested_at desc);
create table public.tarot_consent_events (
 id uuid primary key default gen_random_uuid(), contact_id uuid not null references public.tarot_contacts(id),
 request_id uuid not null unique references public.tarot_requests(id), opted_in boolean not null,
 purpose text not null default 'marketing_email', policy_version text not null,
 recorded_at timestamptz not null default now(), confirmed_at timestamptz, withdrawn_at timestamptz,
 token_hash text unique, token_expires_at timestamptz,
 check(not opted_in or token_hash is not null)
);
create index tarot_consent_contact on public.tarot_consent_events(contact_id,recorded_at desc);
create table public.tarot_rate_limits (
 ip_hash text not null, hour_start timestamptz not null, attempts integer not null,
 primary key(ip_hash,hour_start)
);
create table public.tarot_delivery_events (
 event_id text primary key, provider_id text not null, event_type text not null,
 occurred_at timestamptz not null, recorded_at timestamptz not null default now()
);
-- Browser roles cannot read PII, call privileged functions, or mutate records.
alter table public.tarot_contacts enable row level security;
alter table public.tarot_requests enable row level security;
alter table public.tarot_consent_events enable row level security;
alter table public.tarot_rate_limits enable row level security;
alter table public.tarot_delivery_events enable row level security;
revoke all on public.tarot_contacts,public.tarot_requests,public.tarot_consent_events,public.tarot_rate_limits,public.tarot_delivery_events from anon,authenticated;
grant all on public.tarot_contacts,public.tarot_requests,public.tarot_consent_events,public.tarot_rate_limits,public.tarot_delivery_events to service_role;

create function public.request_free_tarot(p_id uuid,p_first_name text,p_email text,p_marketing_consent boolean,p_policy_version text,p_card jsonb,p_ip_hash text,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare contact uuid; attempts_count integer;
begin
 -- A single short transaction serializes admission across every server instance.
 perform pg_advisory_xact_lock(79164322);
 if p_policy_version <> '2026-10-16.v1' or char_length(p_first_name) not between 1 and 60 or char_length(p_email)>254 or p_email<>lower(trim(p_email)) or p_ip_hash !~ '^[a-f0-9]{64}$' or (p_marketing_consent and (p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$')) then raise exception 'invalid request'; end if;
 delete from tarot_rate_limits where hour_start<now()-interval '2 hours';
 insert into tarot_rate_limits(ip_hash,hour_start,attempts) values(p_ip_hash,date_trunc('hour',now()),1)
 on conflict(ip_hash,hour_start) do update set attempts=tarot_rate_limits.attempts+1 returning attempts into attempts_count;
 if attempts_count>5 then return jsonb_build_object('kind','limited');end if;
 select id into contact from tarot_contacts where email=p_email;
 if contact is not null and exists(select 1 from tarot_requests where contact_id=contact and requested_at>now()-interval '24 hours') then return jsonb_build_object('kind','duplicate');end if;
 if (select count(*) from tarot_requests where requested_at>now()-interval '24 hours')>=200 then return jsonb_build_object('kind','limited');end if;
 insert into tarot_contacts(email,first_name) values(p_email,p_first_name) on conflict(email) do update set first_name=excluded.first_name returning id into contact;
 insert into tarot_requests(id,contact_id,policy_version,card) values(p_id,contact,p_policy_version,p_card);
 insert into tarot_consent_events(contact_id,request_id,opted_in,policy_version,token_hash,token_expires_at)
 values(contact,p_id,p_marketing_consent,p_policy_version,case when p_marketing_consent then p_token_hash else null end,case when p_marketing_consent then now()+interval '48 hours' else null end);
 return jsonb_build_object('kind','accepted','id',p_id);
end $$;

create function public.update_free_tarot(p_id uuid,p_status text,p_reading jsonb default null,p_provider_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_status text;
begin
 select status into current_status from tarot_requests where id=p_id for update;
 if current_status is null then raise exception 'unknown request';end if;
 if not ((current_status='requested' and p_status in ('generating','generation_failed')) or (current_status='generating' and p_status in ('generated','generation_failed')) or (current_status='generated' and p_status in ('mocked','provider_accepted','email_failed'))) then raise exception 'invalid transition';end if;
 -- Webhook may have arrived before send response: provider ID is stored by the adapter update,
 -- then matching pre-recorded events are applied below.
 update tarot_requests set status=p_status,reading=coalesce(p_reading,reading),provider_id=coalesce(p_provider_id,provider_id),updated_at=now() where id=p_id;
 if p_provider_id is not null then
  if exists(select 1 from tarot_delivery_events where provider_id=p_provider_id and event_type='email.bounced') then update tarot_requests set status='bounced' where id=p_id;
  elsif exists(select 1 from tarot_delivery_events where provider_id=p_provider_id and event_type='email.delivered') then update tarot_requests set status='delivered' where id=p_id;end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;

create function public.tarot_marketing_choice(p_token_hash text,p_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.tarot_consent_events;
begin
 select * into event from tarot_consent_events where token_hash=p_token_hash for update;
 if not found then return jsonb_build_object('ok',false);end if;
 if p_action='withdraw' then
  update tarot_consent_events set withdrawn_at=coalesce(withdrawn_at,now()) where contact_id=event.contact_id and opted_in;
 elsif p_action='confirm' and event.opted_in and event.withdrawn_at is null and event.token_expires_at>now() then
  update tarot_consent_events set confirmed_at=coalesce(confirmed_at,now()) where id=event.id;
 else return jsonb_build_object('ok',false);end if;
 return jsonb_build_object('ok',true);
end $$;

create function public.record_tarot_delivery(p_event_id text,p_provider_id text,p_type text,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_type not in ('email.delivered','email.bounced') then return jsonb_build_object('ok',true);end if;
 insert into tarot_delivery_events(event_id,provider_id,event_type,occurred_at) values(p_event_id,p_provider_id,p_type,p_occurred_at) on conflict(event_id) do nothing;
 -- Bounce takes precedence; delivery never reverses a known bounce.
 update tarot_requests set status=case when p_type='email.bounced' then 'bounced' else 'delivered' end,updated_at=now()
 where provider_id=p_provider_id and status in ('provider_accepted','email_failed','delivered') and status<>'bounced';
 return jsonb_build_object('ok',true);
end $$;

-- Only confirmed, current, unwithdrawn opt-ins qualify. A reading alone is never a basis.
create view public.tarot_campaign_eligible with (security_invoker=true) as
select c.id,c.email,c.first_name from tarot_contacts c
join lateral (select * from tarot_consent_events e where e.contact_id=c.id order by recorded_at desc limit 1) e on true
where e.opted_in and e.confirmed_at is not null and e.withdrawn_at is null;
revoke all on public.tarot_campaign_eligible from anon,authenticated;
grant select on public.tarot_campaign_eligible to service_role;
revoke all on function public.request_free_tarot(uuid,text,text,boolean,text,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.update_free_tarot(uuid,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.tarot_marketing_choice(text,text) from public,anon,authenticated;
revoke all on function public.record_tarot_delivery(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.request_free_tarot(uuid,text,text,boolean,text,jsonb,text,text) to service_role;
grant execute on function public.update_free_tarot(uuid,text,jsonb,text) to service_role;
grant execute on function public.tarot_marketing_choice(text,text) to service_role;
grant execute on function public.record_tarot_delivery(text,text,text,timestamptz) to service_role;
