-- Keep both owner Instagram accounts; old locked AI queue stays single-account.
begin;
create table public.own_instagram_accounts(
 id text primary key,username text not null unique check(username in ('divinework.store','travelmellon')),
 token_cipher text not null,expires_at timestamptz not null,refreshed_at timestamptz not null default now(),
 permissions text[] not null default array['instagram_business_basic','instagram_business_content_publish']
);
create table public.own_instagram_oauth(hash text primary key,username text not null check(username in ('divinework.store','travelmellon')),expires_at timestamptz not null default now()+interval '10 minutes');
alter table public.own_instagram_accounts enable row level security;
alter table public.own_instagram_oauth enable row level security;
revoke all on public.own_instagram_accounts,public.own_instagram_oauth from anon,authenticated;
create view public.own_instagram_credentials with (security_invoker=true) as
 select id,username,token_cipher,expires_at,refreshed_at,permissions from public.own_instagram_accounts
 union all select id,username,token_cipher,expires_at,refreshed_at,permissions from public.instagram_account a
 where not exists(select 1 from public.own_instagram_accounts b where b.id=a.id or b.username=a.username);
revoke all on public.own_instagram_credentials from anon,authenticated;
alter table public.own_publications drop constraint own_publications_video_id_provider_key;
alter table public.own_publications add constraint own_publications_video_provider_account_key unique(video_id,provider,account_id);
alter function public.own_video_command(text,jsonb) rename to own_video_command_v1;
create function public.own_video_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare asset public.own_videos;pid text;aid text;result jsonb;
begin
 if p_action='ig_oauth_start' then
  delete from public.own_instagram_oauth where expires_at<now();
  insert into public.own_instagram_oauth(hash,username) values(p_data->>'hash',p_data->>'username');return '{}';
 elsif p_action='ig_oauth_consume' then
  delete from public.own_instagram_oauth where hash=p_data->>'hash' and username=p_data->>'username' and expires_at>now();return to_jsonb(found);
 elsif p_action='ig_connect' then
  if exists(select 1 from public.own_instagram_credentials where username=p_data->>'username' and id<>p_data->>'id') then raise exception 'account_mismatch';end if;
  insert into public.own_instagram_accounts(id,username,token_cipher,expires_at) values(p_data->>'id',p_data->>'username',p_data->>'cipher',(p_data->>'expiresAt')::timestamptz)
  on conflict(id) do update set username=excluded.username,token_cipher=excluded.token_cipher,expires_at=excluded.expires_at,refreshed_at=now();return '{}';
 elsif p_action='ig_disconnect' then
  update public.own_publications set status='canceled' where provider='instagram' and account_id=p_data->>'accountId' and status in('queued','waiting');
  delete from public.own_instagram_accounts where id=p_data->>'accountId';
  update public.instagram_account set expires_at=now() where id=p_data->>'accountId';return '{}';
 elsif p_action='ig_accounts' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'username',username,'expiresAt',expires_at,'scopes',permissions) order by username) from public.own_instagram_credentials),'[]'::jsonb);
 elsif p_action='credential' and p_data->>'provider'='instagram' then
  return (select jsonb_build_object('id',id,'cipher',token_cipher,'expiresAt',expires_at,'scopes',permissions) from public.own_instagram_credentials where id=p_data->>'accountId');
 elsif p_action='refresh' and p_data->>'provider'='instagram' then
  update public.own_instagram_accounts set token_cipher=p_data->>'cipher',expires_at=(p_data->>'expiresAt')::timestamptz,refreshed_at=now() where id=p_data->>'accountId';
  if not found then return public.own_video_command_v1(p_action,p_data);end if;return '{}';
 end if;
 if p_action='approve' then
  select * into asset from public.own_videos where id=(p_data->>'id')::uuid for update;
  if not found or asset.state<>'draft' or p_data->>'confirm'<>'true' then raise exception 'unapproved video';end if;
  if (p_data->>'scheduledAt')::timestamptz<now()-interval '1 minute' or (p_data->>'scheduledAt')::timestamptz>now()+interval '90 days' then raise exception 'invalid schedule';end if;
  for pid in select jsonb_array_elements_text(p_data->'providers') loop
   if pid='instagram' then
    for aid in select jsonb_array_elements_text(coalesce(p_data->'instagramAccountIds',(select jsonb_build_array(id) from public.own_instagram_credentials where username='divinework.store'),'[]'::jsonb)) loop
     if not exists(select 1 from public.own_instagram_credentials where id=aid and expires_at>now()) then raise exception 'missing Instagram account';end if;
     insert into public.own_publications(video_id,provider,account_id,scheduled_at,visibility,made_for_kids,notify_subscribers)
     values(asset.id,pid,aid,(p_data->>'scheduledAt')::timestamptz,'public',false,false);
    end loop;
    if not found then raise exception 'Instagram account required';end if;
    continue;
   else select account_id into aid from public.social_connections where provider=pid;end if;
   if aid is null then raise exception 'missing account';end if;
   insert into public.own_publications(video_id,provider,account_id,scheduled_at,visibility,made_for_kids,notify_subscribers)
   values(asset.id,pid,aid,(p_data->>'scheduledAt')::timestamptz,case when pid='youtube' then p_data->>'visibility' else 'public' end,(p_data->>'madeForKids')::boolean,(p_data->>'notifySubscribers')::boolean);
  end loop;
  if not exists(select 1 from public.own_publications where video_id=asset.id) then raise exception 'platform required';end if;
  update public.own_videos set state='approved',approved_at=now() where id=asset.id;return '{}';
 end if;
 return public.own_video_command_v1(p_action,p_data);
end $$;
revoke all on function public.own_video_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.own_video_command(text,jsonb) to service_role;
-- Apply Meta revocation/data deletion to the additional account as well.
alter function public.instagram_command(text,jsonb) rename to instagram_command_v1;
create function public.instagram_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_action='revoke' then
  delete from public.own_instagram_oauth where username in(select username from public.own_instagram_credentials where id=p_data->>'accountId');
  delete from public.own_publications where provider='instagram' and account_id=p_data->>'accountId';
  delete from public.own_instagram_accounts where id=p_data->>'accountId';
 elsif p_action='disconnect' then
  update public.own_publications set status='canceled' where provider='instagram' and account_id in(select id from public.instagram_account) and status in('queued','waiting');
  delete from public.own_instagram_accounts where id in(select id from public.instagram_account);
 end if;
 result:=public.instagram_command_v1(p_action,p_data);return result;
end $$;
revoke all on function public.instagram_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.instagram_command(text,jsonb) to service_role;
commit;
