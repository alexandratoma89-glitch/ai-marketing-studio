create table public.runway_videos(id uuid primary key,single_test boolean not null default true unique check(single_test),prompt text not null check(length(prompt) between 1 and 1000),caption text not null,status text not null default 'draft' check(status in ('draft','submitting','submitted','archiving','ready','failed','uncertain')),model text not null default 'gen4.5',ratio text not null default '720:1280',duration int not null default 5,estimated_credits int not null default 60,reserved_credits int not null default 0,actual_credits numeric,pricing_version text not null default 'gen4.5-mp4-12cps-v1',authorized_at timestamptz,budget_month date,task_id text,provider_status text,output_url text,storage_path text,review text not null default 'pending' check(review in ('pending','approved','rejected')),reviewed_at timestamptz,lease uuid,lease_until timestamptz,next_check timestamptz default now(),polls int not null default 0,last_error text,created_at timestamptz not null default now());
create table public.runway_events(id bigint generated always as identity primary key,video_id uuid references public.runway_videos,event text not null,created_at timestamptz not null default now());
alter table public.runway_videos enable row level security;alter table public.runway_events enable row level security;
revoke all on public.runway_videos,public.runway_events from anon,authenticated;
create function public.runway_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r runway_videos; month_start date:=date_trunc('month',now() at time zone 'Europe/Bucharest')::date; total int;
begin
 perform pg_advisory_xact_lock(1904612);
 if p_action='overview' then return jsonb_build_object('videos',coalesce((select jsonb_agg(to_jsonb(t)-'output_url'-'lease') from runway_videos t),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(t)) from (select * from runway_events order by id desc limit 100)t),'[]'::jsonb),'reservedCredits',coalesce((select sum(reserved_credits) from runway_videos where budget_month=month_start),0));
 elsif p_action='draft' then
 insert into runway_videos(id,prompt,caption) values((p_data->>'id')::uuid,p_data->>'prompt',p_data->>'caption') returning * into r;
 elsif p_action='reserve' then
 select * into r from runway_videos where id=(p_data->>'id')::uuid for update;
 if r.id is null or r.status<>'draft' or r.authorized_at is not null or (p_data->>'confirmed')::boolean is not true then raise exception 'explicit_authorization_required';end if;
 select coalesce(sum(reserved_credits),0) into total from runway_videos where budget_month=month_start;
 if coalesce((p_data->>'monthlyLimit')::int,0)<>60 or coalesce((p_data->>'perTestLimit')::int,0)<>60 or total+60>(p_data->>'monthlyLimit')::int then raise exception 'budget_exceeded';end if;
 -- Reservation is never automatically refunded: unknown/failed submissions may have incurred cost.
 update runway_videos set status='submitting',authorized_at=now(),reserved_credits=60,budget_month=month_start,lease=(p_data->>'lease')::uuid,lease_until=now()+interval '3 minutes' where id=r.id returning * into r;
 elsif p_action='claim' then
 update runway_videos set status='failed',last_error='poll_limit_reached' where status in ('submitted','archiving') and polls>=1440 and (lease is null or lease_until<now());
 update runway_videos set status='uncertain',last_error='submission_outcome_unknown' where status='submitting' and lease_until<now();
 select * into r from runway_videos where status in ('submitted','archiving') and next_check<=now() and (lease is null or lease_until<now()) and polls<1440 limit 1 for update;
 if r.id is null then return null;end if;
 update runway_videos set lease=(p_data->>'lease')::uuid,lease_until=now()+interval '3 minutes',polls=polls+1,next_check=now()+interval '1 minute' where id=r.id returning * into r;return to_jsonb(r);
 elsif p_action='preview' then select * into r from runway_videos where id=(p_data->>'id')::uuid and status='ready';return to_jsonb(r);
 elsif p_action='review' then
 update runway_videos set review=p_data->>'review',reviewed_at=now() where id=(p_data->>'id')::uuid and status='ready' and review='pending' returning * into r;if r.id is null then raise exception 'not_ready_for_review';end if;
 elsif p_action in ('submitted','uncertain','task','saved','error') then
 select * into r from runway_videos where id=(p_data->>'id')::uuid and lease=(p_data->>'lease')::uuid for update;if r.id is null then return 'false';end if;
 if p_action='submitted' then update runway_videos set task_id=p_data->>'taskId',status='submitted',lease=null,next_check=now()+interval '10 seconds' where id=r.id returning * into r;
 elsif p_action='uncertain' then update runway_videos set status='uncertain',last_error='submission_outcome_unknown',lease=null where id=r.id returning * into r;
 elsif p_action='task' then
 update runway_videos set provider_status=p_data->>'providerStatus',actual_credits=coalesce((p_data->>'actualCredits')::numeric,actual_credits),status=case when p_data->>'providerStatus'='SUCCEEDED' then 'archiving' when p_data->>'providerStatus' in ('FAILED','CANCELED','CANCELLED') then 'failed' else 'submitted' end,output_url=coalesce(p_data->>'outputUrl',output_url),lease=null,last_error=case when p_data->>'providerStatus' in ('FAILED','CANCELED','CANCELLED') then 'provider_generation_failed' else null end where id=r.id returning * into r;
 elsif p_action='saved' then update runway_videos set storage_path=p_data->>'path',status='ready',lease=null,last_error=null where id=r.id returning * into r;
 elsif p_action='error' then update runway_videos set last_error=p_data->>'code',lease=null,next_check=now()+interval '2 minutes' where id=r.id returning * into r;
 end if;
 else raise exception 'unsupported_action';end if;
 insert into runway_events(video_id,event) values(r.id,p_action);return to_jsonb(r)-'output_url'-'lease';
end $$;
revoke all on function public.runway_command(text,jsonb) from public,anon,authenticated;grant execute on function public.runway_command(text,jsonb) to service_role;
