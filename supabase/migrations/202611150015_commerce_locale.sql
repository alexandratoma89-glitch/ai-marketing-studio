-- Add customer language without changing existing prices, order states or webhooks.
begin;
alter table public.commerce_orders add column locale text not null default 'ro' check(locale in('en','ro'));
alter function public.commerce_command(text,jsonb) rename to commerce_command_before_locale;
create function public.commerce_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;selected_locale text;
begin
 if p_action='reserve' then
  selected_locale:=coalesce(p_data->>'locale','ro');if selected_locale not in('en','ro') then raise exception 'invalid locale';end if;
 end if;
 result:=public.commerce_command_before_locale(p_action,p_data);
 if p_action='reserve' and result->>'id' is not null then
  update public.commerce_orders set locale=selected_locale where id=(result->>'id')::uuid;
  result:=result||jsonb_build_object('locale',selected_locale);
 end if;
 return result;
end $$;
revoke all on function public.commerce_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.commerce_command(text,jsonb) to service_role;
commit;
