-- Dedicated Brevo marketing list. Existing consent remains the source of truth.
begin;
create table public.marketing_sync (
 contact_id uuid primary key references public.tarot_contacts(id) on delete cascade,
 synced boolean not null default false,
 dirty boolean not null default false,
 suppressed boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.marketing_control (id boolean primary key default true check(id), lease_until timestamptz, lease_token uuid);
insert into public.marketing_control(id) values(true);
create table public.marketing_drafts (
 id uuid primary key, subject text not null, body text not null,
 state text not null default 'creating' check(state in ('creating','draft','uncertain')),
 provider_id bigint, created_at timestamptz not null default now()
);
alter table public.marketing_sync enable row level security;
alter table public.marketing_control enable row level security;
alter table public.marketing_drafts enable row level security;
revoke all on public.marketing_sync,public.marketing_control,public.marketing_drafts from public,anon,authenticated;
grant all on public.marketing_sync,public.marketing_control,public.marketing_drafts to service_role;
create function public.marketing_command(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; token uuid; contact uuid;
begin
 if p_action='status' then
  return jsonb_build_object('eligible',(select count(*) from tarot_campaign_eligible e where not exists(select 1 from marketing_sync s where s.contact_id=e.id and s.suppressed)),
   'synced',(select count(*) from marketing_sync where synced),
   'pending',(select count(*) from (select c.id,coalesce(s.dirty,false) dirty,coalesce(s.synced,false) synced,(e.id is not null and not coalesce(s.suppressed,false)) desired from tarot_contacts c left join marketing_sync s on s.contact_id=c.id left join tarot_campaign_eligible e on e.id=c.id) q where dirty or synced<>desired),
   'drafts',coalesce((select jsonb_agg(d) from(select id,subject,state,provider_id,created_at from marketing_drafts order by created_at desc limit 20)d),'[]'::jsonb));
 elsif p_action='audience' then
  return coalesce((select jsonb_agg(e.email) from tarot_campaign_eligible e join marketing_sync s on s.contact_id=e.id where s.synced and not s.suppressed and not s.dirty),'[]'::jsonb);
 elsif p_action='claim' then
  token:=(p_data->>'token')::uuid;
  update marketing_control set lease_until=now()+interval '110 seconds',lease_token=token where id and (lease_until is null or lease_until<now());
  return jsonb_build_object('claimed',found);
 elsif p_action='release' then
  update marketing_control set lease_until=null,lease_token=null where lease_token=(p_data->>'token')::uuid;
  return '{}';
 elsif p_action='batch' then
  if not exists(select 1 from marketing_control where lease_token=(p_data->>'token')::uuid and lease_until>now()) then raise exception 'lease required'; end if;
  select coalesce(jsonb_agg(q),'[]'::jsonb) into result from (
   select c.id,c.email,c.first_name,coalesce(s.dirty,false) dirty,coalesce(s.synced,false) synced,(e.id is not null and not coalesce(s.suppressed,false)) desired
   from tarot_contacts c left join marketing_sync s on s.contact_id=c.id left join tarot_campaign_eligible e on e.id=c.id
   where coalesce(s.dirty,false) or coalesce(s.synced,false)<>(e.id is not null and not coalesce(s.suppressed,false))
   order by (e.id is not null and not coalesce(s.suppressed,false)),c.id limit 3
  ) q; return result;
 elsif p_action='attempt' then
  if not exists(select 1 from marketing_control where lease_token=(p_data->>'token')::uuid and lease_until>now()) then raise exception 'lease required'; end if;
  insert into marketing_sync(contact_id,dirty) values((p_data->>'id')::uuid,true) on conflict(contact_id) do update set dirty=true; return '{}';
 elsif p_action='applied' then
  if not exists(select 1 from marketing_control where lease_token=(p_data->>'token')::uuid and lease_until>now()) then raise exception 'lease required'; end if;
  insert into marketing_sync(contact_id,synced) values((p_data->>'id')::uuid,(p_data->>'synced')::boolean)
  on conflict(contact_id) do update set synced=excluded.synced,dirty=false,updated_at=now(); return '{}';
 elsif p_action='suppress' then
  select id into contact from tarot_contacts where email=lower(trim(p_data->>'email'));
  if contact is not null then
   insert into marketing_sync(contact_id,suppressed,dirty) values(contact,true,true) on conflict(contact_id) do update set suppressed=true,dirty=true,updated_at=now();
   update tarot_consent_events set withdrawn_at=coalesce(withdrawn_at,now()) where contact_id=contact;
   update commerce_consents set withdrawn_at=coalesce(withdrawn_at,now()) where contact_id=contact;
  end if; return '{}';
 elsif p_action='draft_reserve' then
  if char_length(p_data->>'subject') not between 1 and 150 or char_length(p_data->>'body') not between 1 and 12000 then raise exception 'invalid draft'; end if;
  -- One immutable creation intent per browser id. Never automatically retry uncertain creation.
  insert into marketing_drafts(id,subject,body) values((p_data->>'id')::uuid,p_data->>'subject',p_data->>'body') on conflict do nothing;
  return jsonb_build_object('reserved',found);
 elsif p_action='draft_finish' then
  update marketing_drafts set state=case when p_data->>'providerId' is null then 'uncertain' else 'draft' end,provider_id=(p_data->>'providerId')::bigint where id=(p_data->>'id')::uuid and state='creating'; return '{}';
 end if;
 raise exception 'unsupported marketing command';
end $$;
revoke all on function public.marketing_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.marketing_command(text,jsonb) to service_role;
commit;
