-- Owner uploads only. Existing AI queues remain unchanged and locked.
alter table public.social_connections add column granted_scopes text[] not null default '{}';
alter function public.social_command(text,jsonb) rename to social_connection_command_v1;
create function public.social_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.social_connection_command_v1(p_action,p_data);
 if p_action='connect' then update public.social_connections set granted_scopes=array(select jsonb_array_elements_text(coalesce(p_data->'scopes','[]'::jsonb))) where provider=p_data->>'provider';end if;
 return result;
end $$;
revoke all on function public.social_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.social_command(text,jsonb) to service_role;
create table public.own_videos(
 id uuid primary key,path text not null unique check(path=id::text||'/video.mp4'),source text not null default 'owner_upload' check(source='owner_upload'),
 bytes integer not null check(bytes between 32 and 52428800),duration numeric not null check(duration between 5 and 60),width integer not null,height integer not null,
 title text not null check(length(title) between 1 and 100),caption text not null check(length(caption)<=2100),
 state text not null default 'uploading' check(state in('uploading','draft','approved')),created_at timestamptz not null default now(),approved_at timestamptz
);
create table public.own_publications(
 id uuid primary key default gen_random_uuid(),video_id uuid not null references public.own_videos(id),
 provider text not null check(provider in('instagram','facebook','youtube')),account_id text not null,
 status text not null default 'queued' check(status in('queued','waiting','working','published','restricted','failed','uncertain','canceled')),
 scheduled_at timestamptz not null,next_at timestamptz not null default now(),lease uuid,lease_until timestamptz,
 checkpoint_cipher text,attempts integer not null default 0,last_error text,provider_id text,post_url text,
 visibility text not null check(visibility in('public','unlisted','private')),made_for_kids boolean not null,notify_subscribers boolean not null,
 approved_at timestamptz not null default now(),published_at timestamptz,unique(video_id,provider)
);
alter table public.own_videos enable row level security;alter table public.own_publications enable row level security;
revoke all on public.own_videos,public.own_publications from anon,authenticated;
create function public.own_video_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare asset public.own_videos;job public.own_publications;pid text;aid text;result jsonb;
begin
 if p_action='upload' then
  insert into public.own_videos(id,path,bytes,duration,width,height,title,caption) values((p_data->>'id')::uuid,p_data->>'path',(p_data->>'bytes')::integer,(p_data->>'duration')::numeric,(p_data->>'width')::integer,(p_data->>'height')::integer,p_data->>'title',p_data->>'caption');return '{}';
 elsif p_action='complete' then update public.own_videos set state='draft' where id=(p_data->>'id')::uuid and state='uploading';return '{}';
 elsif p_action='asset' then return (select to_jsonb(v) from public.own_videos v where id=(p_data->>'id')::uuid);
 elsif p_action='edit' then
  update public.own_videos set title=p_data->>'title',caption=p_data->>'caption' where id=(p_data->>'id')::uuid and state='draft';if not found then raise exception 'draft required';end if;return '{}';
 elsif p_action='credential' then
  if p_data->>'provider'='instagram' then return (select jsonb_build_object('id',id,'cipher',token_cipher,'expiresAt',expires_at,'scopes',permissions) from public.instagram_account limit 1);end if;
  return (select jsonb_build_object('id',account_id,'cipher',token_cipher,'expiresAt',expires_at,'scopes',granted_scopes) from public.social_connections where provider=p_data->>'provider');
 elsif p_action='refresh' then
  if p_data->>'provider'='instagram' then update public.instagram_account set token_cipher=p_data->>'cipher',expires_at=(p_data->>'expiresAt')::timestamptz,refreshed_at=now() where id=p_data->>'accountId';
  else update public.social_connections set token_cipher=p_data->>'cipher',expires_at=(p_data->>'expiresAt')::timestamptz where provider=p_data->>'provider' and account_id=p_data->>'accountId';end if;return '{}';
 elsif p_action='approve' then
  select * into asset from public.own_videos where id=(p_data->>'id')::uuid for update;
  if not found or asset.state<>'draft' or p_data->>'confirm'<>'true' then raise exception 'unapproved video';end if;
  if (p_data->>'scheduledAt')::timestamptz<now()-interval '1 minute' or (p_data->>'scheduledAt')::timestamptz>now()+interval '90 days' then raise exception 'invalid schedule';end if;
  for pid in select jsonb_array_elements_text(p_data->'providers') loop
   if pid='instagram' then select id into aid from public.instagram_account limit 1;
   else select account_id into aid from public.social_connections where provider=pid;end if;
   if aid is null then raise exception 'missing account';end if;
   insert into public.own_publications(video_id,provider,account_id,scheduled_at,visibility,made_for_kids,notify_subscribers)
   values(asset.id,pid,aid,(p_data->>'scheduledAt')::timestamptz,case when pid='youtube' then p_data->>'visibility' else 'public' end,(p_data->>'madeForKids')::boolean,(p_data->>'notifySubscribers')::boolean);
  end loop;
  if not found then raise exception 'platform required';end if;
  update public.own_videos set state='approved',approved_at=now() where id=asset.id;return '{}';
 elsif p_action='overview' then
  return jsonb_build_object('videos',coalesce((select jsonb_agg(to_jsonb(v) order by created_at desc) from(select * from public.own_videos order by created_at desc limit 50)v),'[]'::jsonb),'publications',coalesce((select jsonb_agg(to_jsonb(j)-'checkpoint_cipher'-'lease' order by scheduled_at desc) from(select * from public.own_publications order by approved_at desc limit 150)j),'[]'::jsonb));
 elsif p_action='claim' then
  update public.own_publications set status='uncertain',last_error='worker_interrupted',lease=null,lease_until=null where status='working' and lease_until<now();
  select * into job from public.own_publications where provider=any(array(select jsonb_array_elements_text(p_data->'providers'))) and status in('queued','waiting') and scheduled_at<=now()+interval '15 minutes' and next_at<=now() order by scheduled_at,next_at,approved_at for update skip locked limit 1;
  if not found then return null;end if;
  update public.own_publications set status='working',lease=(p_data->>'lease')::uuid,lease_until=now()+interval '3 minutes',attempts=attempts+1 where id=job.id returning * into job;
  return to_jsonb(job)||(select jsonb_build_object('path',path,'bytes',bytes,'title',title,'caption',caption) from public.own_videos where id=job.video_id and state='approved' and source='owner_upload');
 elsif p_action='reconcile_claim' then
  update public.own_publications set status='working',lease=(p_data->>'lease')::uuid,lease_until=now()+interval '3 minutes' where id=(p_data->>'id')::uuid and status='uncertain' returning * into job;
  if not found then return null;end if;return to_jsonb(job)||(select jsonb_build_object('path',path,'bytes',bytes,'title',title,'caption',caption) from public.own_videos where id=job.video_id and state='approved');
 elsif p_action='intent' then
  update public.own_publications set checkpoint_cipher=p_data->>'cipher' where id=(p_data->>'id')::uuid and lease=(p_data->>'lease')::uuid and status='working' and lease_until>now();return to_jsonb(found);
 elsif p_action='save' then
  if p_data->>'status' not in('waiting','published','restricted','failed','uncertain') then raise exception 'invalid status';end if;
  update public.own_publications set status=p_data->>'status',checkpoint_cipher=coalesce(p_data->>'cipher',checkpoint_cipher),provider_id=coalesce(p_data->>'providerId',provider_id),post_url=coalesce(p_data->>'url',post_url),last_error=p_data->>'error',next_at=greatest(now()+interval '30 seconds',coalesce((p_data->>'nextAt')::timestamptz,now())),published_at=case when p_data->>'status'='published' then now() else published_at end,lease=null,lease_until=null
   where id=(p_data->>'id')::uuid and lease=(p_data->>'lease')::uuid and status='working' and lease_until>now();return to_jsonb(found);
 elsif p_action='cancel' then
  update public.own_publications set status='canceled' where id=(p_data->>'id')::uuid and status in('queued','waiting');if not found then raise exception 'cannot cancel active or completed publication';end if;return '{}';
 elsif p_action='retry' then
  update public.own_publications set status='waiting',next_at=now(),last_error=null where id=(p_data->>'id')::uuid and status='failed';if not found then raise exception 'manual verification required';end if;return '{}';
 end if;
 raise exception 'unsupported own video action';
end $$;
revoke all on function public.own_video_command(text,jsonb) from public,anon,authenticated;
grant usage on schema public to service_role;
grant execute on function public.own_video_command(text,jsonb) to service_role;

create index own_publications_due on public.own_publications(status,scheduled_at,next_at);
