create table public.social_connections(provider text primary key check(provider in ('facebook','tiktok','youtube')),account_id text not null,label text not null,token_cipher text not null,expires_at timestamptz not null,connected_at timestamptz not null default now());
create table public.social_oauth(state_hash text primary key,provider text not null,verifier_cipher text not null,expires_at timestamptz not null default now()+interval '10 minutes');
alter table public.social_connections enable row level security;alter table public.social_oauth enable row level security;
revoke all on public.social_connections,public.social_oauth from anon,authenticated;
create function public.social_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_action='start' then delete from social_oauth where expires_at<now();insert into social_oauth(state_hash,provider,verifier_cipher) values(p_data->>'hash',p_data->>'provider',p_data->>'cipher');return '{}';
 elsif p_action='consume' then delete from social_oauth where state_hash=p_data->>'hash' and provider=p_data->>'provider' and expires_at>now() returning jsonb_build_object('verifierCipher',verifier_cipher) into result;return result;
 elsif p_action='connect' then insert into social_connections(provider,account_id,label,token_cipher,expires_at) values(p_data->>'provider',p_data->>'id',p_data->>'label',p_data->>'cipher',(p_data->>'expiresAt')::timestamptz) on conflict(provider) do update set account_id=excluded.account_id,label=excluded.label,token_cipher=excluded.token_cipher,expires_at=excluded.expires_at,connected_at=now();return '{}';
 elsif p_action='overview' then select coalesce(jsonb_agg(jsonb_build_object('provider',provider,'accountId',account_id,'label',label,'expiresAt',expires_at,'expired',expires_at<=now())),'[]'::jsonb) into result from social_connections;return result;
 elsif p_action='disconnect' then delete from social_connections where provider=p_data->>'provider';delete from social_oauth where provider=p_data->>'provider';return '{}';
 end if;raise exception 'unsupported_action';
end $$;
revoke all on function public.social_command(text,jsonb) from public,anon,authenticated;grant usage on schema public to service_role;grant execute on function public.social_command(text,jsonb) to service_role;
