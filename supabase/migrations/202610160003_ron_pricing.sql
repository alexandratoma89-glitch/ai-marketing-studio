-- Additive TEST-only pricing revision. No existing order amounts/currencies/Stripe IDs are updated.
-- Existing USD test subscriptions retain their original contract. No Stripe API calls occur here.
alter table public.commerce_orders drop constraint commerce_orders_currency_check;
alter table public.commerce_orders add constraint commerce_orders_currency_check check(currency in('usd','ron'));
alter table public.commerce_orders alter column currency set default 'ron';
alter table public.commerce_orders add column pricing_version text not null default 'legacy-usd-v1';
alter table public.commerce_orders alter column pricing_version set default 'ro-ron-2026-10-16.v1';
alter table public.commerce_orders add column tax_status text not null default 'unconfirmed' check(tax_status in('unconfirmed','not_registered','inclusive'));
alter table public.commerce_orders add column tax_rate_id text;
alter table public.commerce_orders add constraint commerce_order_inclusive_tax check(tax_status<>'inclusive' or tax_rate_id is not null);

-- Revise only the admission/validation portions of the existing command, preserving booking,
-- consent, locking, cancellation and delivery logic. Fail migration if the expected base differs.
do $$
declare source text;original text;
begin
 source:=pg_get_functiondef('public.commerce_command(text,jsonb)'::regprocedure);
 if position('case when opt then 4410 else 4900 end' in source)=0 or position(';total:=1000;' in source)=0 then raise exception 'Unexpected commerce base; review migration before applying';end if;
 source:=replace(source,'case when opt then 4410 else 4900 end','case when opt then 16110 else 17900 end');
 source:=replace(source,';total:=1000;',';total:=2900;');
 source:=replace(source,'p_data->>''termsVersion''<>''2026-10-16.v1''','p_data->>''termsVersion''<>''2026-10-16.ron-v2''');
 original:=source;
 source:=replace(source,
 'insert into commerce_orders(id,contact_id,kind,slot_id,meeting_mode,amount,intro_discount) values((p_data->>''id'')::uuid,contact,p_data->>''kind'',case when p_data->>''kind''=''booking'' then slot.id else null end,p_data->>''meetingMode'',total,opt)',
 'insert into commerce_orders(id,contact_id,kind,slot_id,meeting_mode,amount,intro_discount,currency,tax_status,tax_rate_id) values((p_data->>''id'')::uuid,contact,p_data->>''kind'',case when p_data->>''kind''=''booking'' then slot.id else null end,p_data->>''meetingMode'',total,opt,''ron'',coalesce(p_data->>''taxStatus'',''unconfirmed''),p_data->>''taxRateId'')');
 if source=original then raise exception 'Order admission did not match expected base';end if;
 source:=replace(source,'p_data->>''currency''<>''usd''','p_data->>''currency'' is distinct from ord.currency');
 source:=replace(source,'(p_data->>''monthlyAmount'')::integer is distinct from 1000','(p_data->>''monthlyAmount'')::integer is distinct from ord.amount');
 source:=replace(source,
 'if (p_data->>''created'')::bigint>=ord.stripe_updated_at then',
 'if (p_data->>''created'')::bigint>=ord.stripe_updated_at then
   if p_data->>''currency'' is distinct from ord.currency or (p_data->>''monthlyAmount'')::integer is distinct from ord.amount or (p_data->>''type''=''invoice.paid'' and p_data->>''invoiceReason''=''subscription_cycle'' and (p_data->>''invoiceTotal'')::integer is distinct from ord.amount) then
    update commerce_orders set member_status=''pricing_mismatch'',stripe_updated_at=(p_data->>''created'')::bigint where id=ord.id;
    return jsonb_build_object(''review'',true);
   end if;');
 source:=replace(source,
 '(p_data->>''monthlyAmount'')::integer is distinct from ord.amount)) then',
 '(p_data->>''monthlyAmount'')::integer is distinct from ord.amount or (p_data->>''memberStatus''=''trialing'' and ((p_data->>''amount'')::integer is distinct from 0 or p_data->>''paymentStatus'' not in(''no_payment_required'',''paid''))) or (p_data->>''memberStatus''=''active'' and ((p_data->>''amount'')::integer is distinct from ord.amount or p_data->>''paymentStatus'' is distinct from ''paid'')))) then');
 source:=replace(source,'meeting_mode,amount,created_at','meeting_mode,amount,currency,created_at');
 execute source;
end $$;
