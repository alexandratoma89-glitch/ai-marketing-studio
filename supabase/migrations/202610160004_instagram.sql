-- Isolated Instagram storage. Never exposes tokens to browser roles.
create table public.instagram_account(singleton boolean primary key default true check(singleton), id text not null, username text not null, token_cipher text not null, expires_at timestamptz not null, refreshed_at timestamptz not null default now(),permissions text[] not null default array['instagram_business_basic','instagram_business_content_publish']);
create table public.instagram_oauth(state_hash text primary key, expires_at timestamptz not null);
create table public.instagram_reels(id uuid primary key, account_id text not null, video_url text not null, caption text not null, ai_generated boolean not null, status text not null default 'draft' check(status in ('draft','approved','processing','publishing','published','failed','uncertain','canceled')), approved_at timestamptz, approved_by text, ai_disclosure_confirmed boolean not null default false, scheduled_at timestamptz, container_id text, media_id text, post_url text, attempts int not null default 0, next_attempt timestamptz not null default now(), lease uuid, lease_until timestamptz, last_error text, created_at timestamptz not null default now());
create table public.instagram_history(id bigint generated always as identity primary key, reel_id uuid references public.instagram_reels, event text not null, created_at timestamptz not null default now());
alter table public.instagram_account enable row level security;
alter table public.instagram_oauth enable row level security;
alter table public.instagram_reels enable row level security;
alter table public.instagram_history enable row level security;
revoke all on public.instagram_account,public.instagram_oauth,public.instagram_reels,public.instagram_history from anon,authenticated;
create function public.instagram_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r instagram_reels; a instagram_account; result jsonb;
begin
 perform pg_advisory_xact_lock(1904611);
 if p_action='oauth_start' then
 delete from instagram_oauth where expires_at<now();
 insert into instagram_oauth values(p_data->>'hash',now()+interval '10 minutes');return '{}';
 elsif p_action='oauth_consume' then
 delete from instagram_oauth where state_hash=p_data->>'hash' and expires_at>now() returning to_jsonb(state_hash) into result;return to_jsonb(result is not null);
 elsif p_action='connect' then
 select * into a from instagram_account;
 if a.id is not null and a.id<>p_data->>'id' then raise exception 'account_mismatch';end if;
 insert into instagram_account(singleton,id,username,token_cipher,expires_at) values(true,p_data->>'id',p_data->>'username',p_data->>'cipher',(p_data->>'expiresAt')::timestamptz) on conflict(singleton) do update set username=excluded.username,token_cipher=excluded.token_cipher,expires_at=excluded.expires_at,refreshed_at=now();return '{}';
 elsif p_action='invalidate' then update instagram_account set expires_at=now() where id=p_data->>'id';return '{}';
 elsif p_action='account' then select to_jsonb(t) into result from instagram_account t;return result;
 elsif p_action='overview' then
 return jsonb_build_object('account',(select jsonb_build_object('username',username,'expiresAt',expires_at,'expired',expires_at<=now(),'permissions',permissions,'publishingVerified',exists(select 1 from instagram_reels where account_id=instagram_account.id and status='published' and post_url is not null)) from instagram_account),'reels',coalesce((select jsonb_agg(to_jsonb(t)-'lease') from (select * from instagram_reels order by created_at desc limit 100)t),'[]'::jsonb),'history',coalesce((select jsonb_agg(to_jsonb(t)) from (select * from instagram_history order by id desc limit 100)t),'[]'::jsonb));
 elsif p_action='revoke' then
 if exists(select 1 from instagram_account where id=p_data->>'accountId') then
 delete from instagram_history;delete from instagram_reels;delete from instagram_account;delete from instagram_oauth;end if;return '{}';
 elsif p_action='disconnect' then
 delete from instagram_account;delete from instagram_oauth;
 update instagram_reels set status='canceled',lease=null where status in ('draft','approved','processing','failed');return '{}';
 elsif p_action='draft' then
 select * into a from instagram_account where expires_at>now();if a.id is null then raise exception 'connect_required';end if;
 insert into instagram_reels(id,account_id,video_url,caption,ai_generated) values((p_data->>'id')::uuid,a.id,p_data->>'videoUrl',p_data->>'caption',(p_data->>'aiGenerated')::boolean);return '{}';
 elsif p_action in ('approve','cancel','retry') then
 select * into r from instagram_reels where id=(p_data->>'id')::uuid for update;
 if r.id is null then raise exception 'unknown_reel';end if;
 if p_action='approve' and r.status='draft' and (p_data->>'aiDisclosureConfirmed')::boolean is true and (p_data->>'scheduledAt')::timestamptz>now() then
 update instagram_reels set status='approved',approved_at=now(),approved_by='studio-owner',ai_disclosure_confirmed=true,scheduled_at=(p_data->>'scheduledAt')::timestamptz where id=r.id;
 elsif p_action='cancel' and r.status in ('draft','approved','failed','processing') then update instagram_reels set status='canceled',lease=null where id=r.id;
 elsif p_action='retry' and r.status='failed' and r.approved_at is not null and r.container_id is null and r.media_id is null then update instagram_reels set status='approved',attempts=0,next_attempt=now(),last_error=null where id=r.id;
 else raise exception 'invalid_transition';end if;
 insert into instagram_history(reel_id,event) values(r.id,p_action);return '{}';
 elsif p_action='claim_link' then
 select * into r from instagram_reels where status='published' and media_id is not null and post_url is null and next_attempt<=now() and attempts<10 and (lease_until is null or lease_until<now() or lease is null) and account_id=(select id from instagram_account where expires_at>now()) order by created_at limit 1 for update;
 if r.id is null then return null;end if;update instagram_reels set lease=(p_data->>'lease')::uuid,lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=r.id returning * into r;return to_jsonb(r);
 elsif p_action='claim' then
 update instagram_reels set status='failed',last_error='processing_attempts_exhausted',lease=null where status='processing' and lease_until<now() and attempts>=5;
 update instagram_reels set status='uncertain',last_error='publication_outcome_unknown' where status='publishing' and lease_until<now();
 select * into r from instagram_reels where approved_at is not null and scheduled_at<=now() and next_attempt<=now() and attempts<5 and (status='approved' or (status='processing' and lease_until<now())) and account_id=(select id from instagram_account where expires_at>now()) order by scheduled_at limit 1 for update;
 if r.id is null then return null;end if;
 update instagram_reels set status='processing',attempts=attempts+1,lease=(p_data->>'lease')::uuid,lease_until=now()+interval '2 minutes' where id=r.id returning * into r;
 insert into instagram_history(reel_id,event) values(r.id,'claimed');return to_jsonb(r);
 elsif p_action in ('container','wait','intent','published','permalink','error') then
 select * into r from instagram_reels where id=(p_data->>'id')::uuid and lease=(p_data->>'lease')::uuid for update;
 if r.id is null or r.status not in ('processing','publishing','published') then return 'false';end if;
 if p_action='container' then update instagram_reels set container_id=p_data->>'containerId' where id=r.id;
 elsif p_action='wait' then update instagram_reels set status=case when attempts>=5 then 'failed' else 'approved' end,next_attempt=now()+interval '1 minute',lease=null where id=r.id;
 elsif p_action='intent' then
 if r.status<>'processing' or r.approved_at is null or not exists(select 1 from instagram_account where id=r.account_id and expires_at>now()) then return 'false';end if;
 update instagram_reels set status='publishing',lease_until=now()+interval '2 minutes' where id=r.id;
 elsif p_action='published' then update instagram_reels set status='published',media_id=p_data->>'mediaId',last_error=null where id=r.id;
 elsif p_action='permalink' then update instagram_reels set post_url=p_data->>'url',last_error=null where id=r.id;
 elsif p_action='error' then update instagram_reels set status=case when r.status='publishing' then 'uncertain' when r.status='published' then 'published' when (p_data->>'retryable')::boolean and attempts<5 then 'approved' else 'failed' end,next_attempt=now()+make_interval(secs=>least(3600,60*power(2,attempts)::int)),last_error=p_data->>'code',lease=null where id=r.id;
 end if;
 insert into instagram_history(reel_id,event) values(r.id,case when p_action='error' then 'error:'||(p_data->>'code') else p_action end);return 'true';
 end if;
 raise exception 'unsupported_action';
end $$;
revoke all on function public.instagram_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.instagram_command(text,jsonb) to service_role;
