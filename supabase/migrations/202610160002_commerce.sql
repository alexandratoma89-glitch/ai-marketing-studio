-- Additive migration. All monetary values are USD integer cents. Only TEST state is supported.
create table public.commerce_slots(
 id uuid primary key default gen_random_uuid(),starts_at timestamptz not null unique,
 ends_at timestamptz not null check(ends_at=starts_at+interval '30 minutes'),
 modes text[] not null default array['audio','video'],meeting_url text not null,
 enabled boolean not null default true,check(modes<@array['audio','video']::text[] and cardinality(modes)>0),check(meeting_url like 'https://%')
);
create table public.commerce_orders(
 id uuid primary key,contact_id uuid not null references public.tarot_contacts(id),kind text not null check(kind in('booking','membership')),
 slot_id uuid references public.commerce_slots(id),meeting_mode text check(meeting_mode in('audio','video')),
 status text not null default 'pending' check(status in('pending','confirmed','expired','cancelled','refund_pending','refunded','needs_review')),
 amount integer not null,currency text not null default 'usd' check(currency='usd'),intro_discount boolean not null default false,
 checkout_id text unique,payment_intent text,customer_id text,subscription_id text unique,
 member_status text,member_until timestamptz,cancel_at_period_end boolean not null default false,
 last_error text,stripe_updated_at bigint not null default 0,created_at timestamptz not null default now(),hold_until timestamptz not null default now()+interval '40 minutes',
 test_mode boolean not null default true check(test_mode),check((kind='booking' and slot_id is not null and meeting_mode is not null) or(kind='membership' and slot_id is null))
);
create unique index commerce_one_slot on public.commerce_orders(slot_id) where status in('pending','confirmed');
create unique index commerce_pending_contact on public.commerce_orders(contact_id,kind) where status='pending';
create unique index commerce_active_member on public.commerce_orders(contact_id) where kind='membership' and status='confirmed' and member_status in('trialing','active','past_due','unpaid');
create table public.commerce_consents(
 id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.commerce_orders(id),contact_id uuid not null references public.tarot_contacts(id),
 marketing_opt_in boolean not null,policy_version text not null,recorded_at timestamptz not null default now(),confirmed_at timestamptz,withdrawn_at timestamptz,
 terms_version text not null,terms_accepted boolean not null check(terms_accepted),
 token_hash text unique,token_expires_at timestamptz,
 check(not marketing_opt_in or token_hash is not null) -- Confirmation remains separate from service acceptance.
);
create table public.commerce_webhook_events(id text primary key,event_type text not null,recorded_at timestamptz not null default now());
create table public.commerce_outbox(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.commerce_orders(id),kind text not null,
 dedupe_key text not null unique,status text not null default 'pending' check(status in('pending','processing','generated','mocked','provider_accepted','delivered','bounced','failed','uncertain','suppressed')),
 reading jsonb,provider_id text,attempts integer not null default 0,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.commerce_email_events(id text primary key,provider_id text not null,status text not null,created_at timestamptz not null default now());
create index commerce_outbox_pending on public.commerce_outbox(created_at) where status='pending';
-- No customer information is accessible to browser roles.
do $$declare tab text;begin foreach tab in array array['commerce_slots','commerce_orders','commerce_consents','commerce_webhook_events','commerce_outbox','commerce_email_events'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from anon,authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
end loop;end $$;

create function public.commerce_command(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare slot commerce_slots;ord commerce_orders;contact uuid;job commerce_outbox;event text;total integer;opt boolean;email_address text;result jsonb;start_time timestamptz;
begin
 -- Serializes short state transitions (provider calls always run outside transactions).
 perform pg_advisory_xact_lock(79164323);
 if p_action='slots' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'startsAt',s.starts_at,'endsAt',s.ends_at,'modes',s.modes) order by s.starts_at)
   from commerce_slots s where s.enabled and s.starts_at>now()+interval '2 hours' and s.starts_at<now()+interval '90 days'
   and not exists(select 1 from commerce_orders o where o.slot_id=s.id and o.status in('pending','confirmed','needs_review'))),'[]'::jsonb);
 elsif p_action='create_slot' then
  start_time:=(p_data->>'startsAt')::timestamptz;
  if start_time<now()+interval '2 hours' or start_time>now()+interval '90 days' or p_data->>'meetingUrl' not like 'https://%' then raise exception 'invalid slot';end if;
  if exists(select 1 from commerce_slots s where (s.enabled or exists(select 1 from commerce_orders o where o.slot_id=s.id and o.status in('pending','confirmed','needs_review'))) and tstzrange(starts_at,ends_at,'[)')&&tstzrange(start_time,start_time+interval '30 minutes','[)')) then raise exception 'overlapping slot';end if;
  insert into commerce_slots(starts_at,ends_at,meeting_url,modes) values(start_time,start_time+interval '30 minutes',p_data->>'meetingUrl',array(select jsonb_array_elements_text(p_data->'modes'))) returning * into slot;
  return to_jsonb(slot);
 elsif p_action='disable_slot' then
  update commerce_slots set enabled=false where id=(p_data->>'id')::uuid;return jsonb_build_object('ok',true);
 elsif p_action='reserve' then
  if p_data->>'kind' not in('booking','membership') or p_data->>'policyVersion'<>'2026-10-16.v1' or p_data->>'termsVersion'<>'2026-10-16.v1' or (p_data->>'termsAccepted')::boolean is distinct from true then raise exception 'invalid request';end if;
  email_address:=lower(trim(p_data->>'email'));
  if char_length(email_address)>254 or email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid email';end if;
  -- Durable per-IP admission limit, separate namespace from free tarot.
  insert into tarot_rate_limits(ip_hash,hour_start,attempts) values('commerce:'||(p_data->>'ipHash'),date_trunc('hour',now()),1)
  on conflict(ip_hash,hour_start) do update set attempts=tarot_rate_limits.attempts+1 returning attempts into total;
  if total>5 then return jsonb_build_object('error','limited');end if;
  insert into tarot_contacts(email,first_name) values(email_address,p_data->>'firstName') on conflict(email) do update set first_name=excluded.first_name returning id into contact;
  if exists(select 1 from commerce_orders where contact_id=contact and kind=p_data->>'kind' and status='pending') then return jsonb_build_object('error','pending_exists');end if;
  if p_data->>'kind'='booking' then
   select * into slot from commerce_slots where id=(p_data->>'slotId')::uuid and enabled and starts_at>now()+interval '2 hours';
   if not found or not (p_data->>'meetingMode'=any(slot.modes)) or exists(select 1 from commerce_orders where slot_id=slot.id and status in('pending','confirmed','needs_review')) then return jsonb_build_object('error','unavailable');end if;
   opt:=not exists(select 1 from commerce_orders where contact_id=contact and kind='booking' and status in('confirmed','refunded','refund_pending','cancelled','needs_review'));
   total:=case when opt then 4410 else 4900 end;
  else
   if exists(select 1 from commerce_orders where contact_id=contact and kind='membership' and status='confirmed' and member_status in('active','trialing','past_due','unpaid')) then return jsonb_build_object('error','membership_exists');end if;
   -- Trial once per normalized email, including a previously cancelled membership.
   opt:=not exists(select 1 from commerce_orders where contact_id=contact and kind='membership' and subscription_id is not null);total:=1000;
  end if;
  insert into commerce_orders(id,contact_id,kind,slot_id,meeting_mode,amount,intro_discount) values((p_data->>'id')::uuid,contact,p_data->>'kind',case when p_data->>'kind'='booking' then slot.id else null end,p_data->>'meetingMode',total,opt) returning * into ord;
  insert into commerce_consents(order_id,contact_id,marketing_opt_in,policy_version,terms_version,terms_accepted,token_hash,token_expires_at) values(ord.id,contact,(p_data->>'marketingConsent')::boolean,p_data->>'policyVersion',p_data->>'termsVersion',true,p_data->>'consentTokenHash',case when (p_data->>'marketingConsent')::boolean then now()+interval '48 hours' else null end);
  return to_jsonb(ord);
 elsif p_action='checkout_failed' then
  update commerce_orders set status='expired',last_error='checkout_rejected' where id=(p_data->>'id')::uuid and status='pending' and checkout_id is null;return jsonb_build_object('ok',true);
 elsif p_action='checkout_uncertain' then
  update commerce_orders set last_error='checkout_result_uncertain' where id=(p_data->>'id')::uuid and status='pending';return jsonb_build_object('ok',true);
 elsif p_action='attach_checkout' then
  update commerce_orders set checkout_id=p_data->>'checkoutId' where id=(p_data->>'id')::uuid and status='pending' and (checkout_id is null or checkout_id=p_data->>'checkoutId');return jsonb_build_object('ok',true);
 elsif p_action='get_consent' then
  return coalesce((select to_jsonb(c) from commerce_consents c where order_id=(p_data->>'id')::uuid),'{}'::jsonb);
 elsif p_action='get_order' then
  select * into ord from commerce_orders where id=(p_data->>'id')::uuid;
  if not found then return 'null'::jsonb;end if;
  select jsonb_build_object('email',c.email,'firstName',c.first_name) into result from tarot_contacts c where c.id=ord.contact_id;
  return to_jsonb(ord)||result||coalesce((select jsonb_build_object('startsAt',starts_at,'meetingUrl',meeting_url) from commerce_slots where id=ord.slot_id),'{}'::jsonb);
 elsif p_action='checkout_event' then
  if (p_data->>'livemode')::boolean is distinct from false then raise exception 'live event forbidden';end if;
  select * into ord from commerce_orders where id=(p_data->>'orderId')::uuid for update;
  if not found then raise exception 'unknown checkout order';end if;
  if ord.checkout_id is not null and ord.checkout_id<>p_data->>'checkoutId' then raise exception 'checkout mismatch';end if;
  if exists(select 1 from commerce_webhook_events where id=p_data->>'eventId') then return jsonb_build_object('duplicate',true);end if;
  insert into commerce_webhook_events(id,event_type) values(p_data->>'eventId',p_data->>'type');
  update commerce_orders set checkout_id=p_data->>'checkoutId' where id=ord.id and checkout_id is null;
  if p_data->>'type'='checkout.session.expired' then
   update commerce_orders set status='expired' where id=ord.id and status='pending';
  elsif p_data->>'type' in('checkout.session.completed','checkout.session.async_payment_succeeded') then
   if ord.status='confirmed' then return jsonb_build_object('ok',true);end if;
   if ord.status<>'pending' then update commerce_orders set status='needs_review' where id=ord.id;return jsonb_build_object('review',true);end if;
   if p_data->>'currency'<>'usd' or (ord.kind='booking' and ((p_data->>'amount')::integer is distinct from ord.amount or p_data->>'paymentStatus' is distinct from 'paid'))
    or (ord.kind='membership' and (p_data->>'subscriptionId' is null or p_data->>'memberStatus' not in('active','trialing') or (p_data->>'monthlyAmount')::integer is distinct from 1000)) then
    update commerce_orders set status='needs_review' where id=ord.id;return jsonb_build_object('review',true);
   end if;
   update commerce_orders set status='confirmed',payment_intent=p_data->>'paymentIntent',customer_id=p_data->>'customerId',subscription_id=p_data->>'subscriptionId',member_status=p_data->>'memberStatus',member_until=to_timestamp((p_data->>'memberUntil')::double precision),stripe_updated_at=(p_data->>'created')::bigint where id=ord.id;
   insert into commerce_outbox(order_id,kind,dedupe_key) values(ord.id,case when ord.kind='booking' then 'booking_confirmed' else 'membership_welcome' end,'confirmation:'||ord.id) on conflict(dedupe_key) do nothing;
  end if;return jsonb_build_object('ok',true);
 elsif p_action='subscription_event' then
  if (p_data->>'livemode')::boolean is distinct from false then raise exception 'live event forbidden';end if;
  select * into ord from commerce_orders where subscription_id=p_data->>'subscriptionId' for update;
  if not found then raise exception 'subscription checkout not yet recorded';end if;
  if exists(select 1 from commerce_webhook_events where id=p_data->>'eventId') then return jsonb_build_object('duplicate',true);end if;
  insert into commerce_webhook_events(id,event_type) values(p_data->>'eventId',p_data->>'type');
  if (p_data->>'created')::bigint>=ord.stripe_updated_at then
   update commerce_orders set member_status=p_data->>'memberStatus',member_until=to_timestamp((p_data->>'memberUntil')::double precision),cancel_at_period_end=(p_data->>'cancelAtPeriodEnd')::boolean,stripe_updated_at=(p_data->>'created')::bigint where id=ord.id;
  end if;return jsonb_build_object('ok',true);
 elsif p_action='request_access' then
  -- Generic public response; issue links via email only. One request per order/hour.
  insert into tarot_rate_limits(ip_hash,hour_start,attempts) values('access:'||(p_data->>'ipHash'),date_trunc('hour',now()),1) on conflict(ip_hash,hour_start) do update set attempts=tarot_rate_limits.attempts+1 returning attempts into total;
  if total>5 then return jsonb_build_object('accepted',true);end if;
  insert into commerce_outbox(order_id,kind,dedupe_key) select id,'manage_link','access:'||id||':'||date_trunc('hour',now()) from commerce_orders o join tarot_contacts c on c.id=o.contact_id where c.email=lower(trim(p_data->>'email')) and o.status in('confirmed','refund_pending','refunded','cancelled') on conflict(dedupe_key) do nothing;
  return jsonb_build_object('accepted',true);
 elsif p_action='cancel_booking' then
  select * into ord from commerce_orders where id=(p_data->>'id')::uuid for update;
  if ord.kind<>'booking' or ord.status not in('confirmed','refund_pending') or not exists(select 1 from commerce_slots where id=ord.slot_id and starts_at>now()) then return jsonb_build_object('error','not_cancellable');end if;
  update commerce_orders set status='refund_pending' where id=ord.id;
  insert into commerce_outbox(order_id,kind,dedupe_key) values(ord.id,'booking_cancelled','cancel:'||ord.id) on conflict(dedupe_key) do nothing;
  return to_jsonb(ord);
 elsif p_action='refund_event' then
  if (p_data->>'livemode')::boolean is distinct from false then raise exception 'live event forbidden';end if;
  insert into commerce_webhook_events(id,event_type) values(p_data->>'eventId','charge.refunded') on conflict(id) do nothing;
  update commerce_orders set status=case when (p_data->>'amountRefunded')::integer>=amount then 'refunded' else 'needs_review' end where payment_intent=p_data->>'paymentIntent';return jsonb_build_object('ok',true);
 elsif p_action='enqueue_daily' then
  if extract(hour from now() at time zone 'Europe/Bucharest')<8 then return jsonb_build_object('ok',true);end if;
  insert into commerce_outbox(order_id,kind,dedupe_key)
   select id,'daily_reading','daily:'||id||':'||(now() at time zone 'Europe/Bucharest')::date from commerce_orders
   where kind='membership' and status='confirmed' and member_status in('trialing','active') and member_until>now() and not exists(select 1 from commerce_outbox blocked join commerce_orders bo on bo.id=blocked.order_id where bo.contact_id=commerce_orders.contact_id and blocked.status='bounced')
   on conflict(dedupe_key) do nothing;return jsonb_build_object('ok',true);
 elsif p_action='claim_job' then
  select * into job from commerce_outbox where status='pending' order by created_at for update skip locked limit 1;
  if not found then return 'null'::jsonb;end if;
  if job.kind='daily_reading' and not exists(select 1 from commerce_orders where id=job.order_id and status='confirmed' and member_status in('active','trialing') and member_until>now()) then
   update commerce_outbox set status='suppressed',updated_at=now() where id=job.id;return jsonb_build_object('skip',true);
  end if;
  update commerce_outbox set status='processing',attempts=attempts+1,updated_at=now() where id=job.id;return to_jsonb(job);
 elsif p_action='update_job' then
  update commerce_outbox set status=p_data->>'status',reading=coalesce(p_data->'reading',reading),provider_id=coalesce(p_data->>'providerId',provider_id),last_error=p_data->>'error',updated_at=now() where id=(p_data->>'id')::uuid and status in('processing','generated');
  if p_data->>'providerId' is not null and p_data->>'status'='provider_accepted' then
   if exists(select 1 from commerce_email_events where provider_id=p_data->>'providerId' and status='bounced') then update commerce_outbox set status='bounced' where id=(p_data->>'id')::uuid;
   elsif exists(select 1 from commerce_email_events where provider_id=p_data->>'providerId' and status='delivered') then update commerce_outbox set status='delivered' where id=(p_data->>'id')::uuid;end if;
  end if;return jsonb_build_object('ok',true);
 elsif p_action='delivery_event' then
  insert into commerce_email_events(id,provider_id,status) values(p_data->>'eventId',p_data->>'providerId',p_data->>'status') on conflict(id) do nothing;
  update commerce_outbox set status=p_data->>'status',updated_at=now() where provider_id=p_data->>'providerId' and status in('provider_accepted','uncertain','delivered') and p_data->>'status' in('delivered','bounced');return jsonb_build_object('ok',true);
 elsif p_action='pending_orders' then return coalesce((select jsonb_agg(to_jsonb(o)) from commerce_orders o where status='pending' and checkout_id is not null and hold_until<now()),'[]'::jsonb);
 elsif p_action='studio' then
  return jsonb_build_object('slots',coalesce((select jsonb_agg(to_jsonb(s) order by starts_at) from commerce_slots s where starts_at>now()),'[]'::jsonb),'orders',coalesce((select jsonb_agg(to_jsonb(o)) from(select id,kind,status,meeting_mode,amount,created_at,member_status,cancel_at_period_end,last_error from commerce_orders order by created_at desc limit 50)o),'[]'::jsonb),'logs',coalesce((select jsonb_agg(to_jsonb(l)) from(select id,kind,status,last_error,created_at from commerce_outbox order by created_at desc limit 50)l),'[]'::jsonb));
 end if;
 raise exception 'unknown commerce action';
end $$;
revoke all on function public.commerce_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.commerce_command(text,jsonb) to service_role;

-- Unified marketing eligibility. Service purchase/trial alone never qualifies a contact.
create or replace view public.tarot_campaign_eligible with(security_invoker=true) as
select c.id,c.email,c.first_name from tarot_contacts c
join lateral (
 select choice.* from (
  select opted_in,confirmed_at,withdrawn_at,recorded_at from tarot_consent_events where contact_id=c.id
  union all
  select marketing_opt_in,confirmed_at,withdrawn_at,recorded_at from commerce_consents where contact_id=c.id
 )choice order by recorded_at desc limit 1
)e on true where e.opted_in and e.confirmed_at is not null and e.withdrawn_at is null and not exists(select 1 from tarot_requests r where r.contact_id=c.id and r.status='bounced') and not exists(select 1 from commerce_outbox l join commerce_orders o on o.id=l.order_id where o.contact_id=c.id and l.status='bounced');
create or replace function public.tarot_marketing_choice(p_token_hash text,p_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare contact uuid;expiry timestamptz;withdrawn timestamptz;opted boolean;
begin
 perform pg_advisory_xact_lock(79164323);
 select contact_id,token_expires_at,withdrawn_at,opted_in into contact,expiry,withdrawn,opted from tarot_consent_events where token_hash=p_token_hash;
 if not found then select contact_id,token_expires_at,withdrawn_at,marketing_opt_in into contact,expiry,withdrawn,opted from commerce_consents where token_hash=p_token_hash;end if;
 if contact is null then return jsonb_build_object('ok',false);end if;
 if p_action='withdraw' then
  update tarot_consent_events set withdrawn_at=coalesce(withdrawn_at,now()) where contact_id=contact;
  update commerce_consents set withdrawn_at=coalesce(withdrawn_at,now()) where contact_id=contact;
 elsif p_action='confirm' and opted and withdrawn is null and expiry>now() then
  update tarot_consent_events set confirmed_at=coalesce(confirmed_at,now()) where token_hash=p_token_hash;
  update commerce_consents set confirmed_at=coalesce(confirmed_at,now()) where token_hash=p_token_hash;
 else return jsonb_build_object('ok',false);end if;
 return jsonb_build_object('ok',true);
end $$;
