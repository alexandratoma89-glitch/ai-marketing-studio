-- Additive: no existing booking, payment, currency, or price is changed.
create table public.commerce_invoices(
 id text primary key check(id~'^in_[A-Za-z0-9_]+$'),
 order_id uuid not null unique references public.commerce_orders(id),
 customer_id text not null,status text not null check(status in('draft','open','paid','void','uncollectible')),
 currency text not null,total integer not null check(total>=0),
 number text,hosted_url text check(hosted_url is null or hosted_url~'^https://(invoice|pay)\.stripe\.com/'),pdf_url text check(pdf_url is null or pdf_url~'^https://(invoice|pay)\.stripe\.com/'),updated_at timestamptz not null default now()
);
alter table public.commerce_invoices enable row level security;
revoke all on public.commerce_invoices from anon,authenticated;
create function public.commerce_invoice_command(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ord public.commerce_orders;item public.commerce_invoices;
begin
 if p_action='invoice_record' then
  select * into ord from public.commerce_orders where id=(p_data->>'orderId')::uuid for update;
  if not found or ord.kind<>'booking' or p_data->>'currency' is distinct from ord.currency
   or (p_data->>'total')::integer is distinct from ord.amount
   or (p_data->>'customerId') is null
   or (ord.customer_id is not null and ord.customer_id<>p_data->>'customerId')
   or (p_data->>'livemode')::boolean is distinct from false then raise exception 'invoice validation failed';end if;
  if exists(select 1 from public.commerce_invoices where id=p_data->>'id' and order_id<>ord.id) then raise exception 'invoice belongs to another order';end if;
  select * into item from public.commerce_invoices where order_id=ord.id;
  if found and item.id<>p_data->>'id' then raise exception 'different invoice already recorded';end if;
  insert into public.commerce_invoices(id,order_id,customer_id,status,currency,total,number,hosted_url,pdf_url)
   values(p_data->>'id',ord.id,p_data->>'customerId',p_data->>'status',p_data->>'currency',(p_data->>'total')::integer,p_data->>'number',p_data->>'hostedUrl',p_data->>'pdfUrl')
   on conflict(id) do update set status=case when commerce_invoices.status in('paid','void') then commerce_invoices.status when commerce_invoices.status='uncollectible' and excluded.status in('draft','open') then commerce_invoices.status when commerce_invoices.status='open' and excluded.status='draft' then commerce_invoices.status else excluded.status end,number=coalesce(excluded.number,commerce_invoices.number),hosted_url=coalesce(excluded.hosted_url,commerce_invoices.hosted_url),pdf_url=coalesce(excluded.pdf_url,commerce_invoices.pdf_url),updated_at=now()
   where commerce_invoices.order_id=excluded.order_id;
  return jsonb_build_object('recorded',true);
 elsif p_action='invoice_get' then
  return (select to_jsonb(i) from public.commerce_invoices i join public.commerce_orders o on o.id=i.order_id where i.order_id=(p_data->>'id')::uuid and (o.customer_id is null or o.customer_id=i.customer_id));
 elsif p_action='invoice_list' then
  return coalesce((select jsonb_agg(to_jsonb(i) order by updated_at desc) from(select * from public.commerce_invoices order by updated_at desc limit 50)i),'[]'::jsonb);
 end if;
 raise exception 'unknown invoice action';
end $$;
revoke all on function public.commerce_invoice_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.commerce_invoice_command(text,jsonb) to service_role;

grant usage on schema public to service_role;
