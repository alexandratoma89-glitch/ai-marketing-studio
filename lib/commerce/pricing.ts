// New offers only. Existing orders/subscriptions always use their stored currency and amount.
export const COMMERCE_TERMS_VERSION='2026-10-16.ron-v2';
export const PRICING_VERSION='ro-ron-2026-10-16.v1';
export const CURRENCY='ron' as const;
export const PRIVATE_READING_BANI=17900;
export const WELCOME_DISCOUNT_PERCENT=10;
export const WELCOME_DISCOUNT_BANI=1790;
export const FIRST_READING_BANI=PRIVATE_READING_BANI-WELCOME_DISCOUNT_BANI;
export const MEMBERSHIP_BANI=2900;
export const FREE_READING_BANI=0;
export type TaxStatus='unconfirmed'|'not_registered'|'inclusive';
export interface TaxSnapshot {tax_status?:TaxStatus;tax_rate_id?:string|null}
export function formatMoney(amount:number,currency:string='ron'){
 if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Invalid monetary amount');
 const digits=amount%100===0?0:2;
 if(currency==='ron')return new Intl.NumberFormat('ro-RO',{minimumFractionDigits:digits,maximumFractionDigits:2}).format(amount/100)+' lei';
 return new Intl.NumberFormat('ro-RO',{style:'currency',currency:currency.toUpperCase()}).format(amount/100);
}
export function taxNotice(status:TaxStatus='unconfirmed'){
 if(status==='not_registered')return 'Preț final. Furnizor neînregistrat în scopuri de TVA; nu se aplică TVA.';
 if(status==='inclusive')return 'Preț final, cu TVA inclus. Nu se adaugă taxe în Checkout.';
 return 'Preț final de test; nu se adaugă taxe în Checkout. Regimul TVA este în curs de confirmare.';
}
export function taxConfig(env:Record<string,string|undefined>=process.env):TaxSnapshot{
 const value=env.COMMERCE_TAX_STATUS??'unconfirmed';
 if(!['unconfirmed','not_registered','inclusive'].includes(value))throw new Error('Invalid tax configuration');
 const rate=env.STRIPE_TEST_INCLUSIVE_TAX_RATE_ID;
 if(value==='inclusive'&&(!rate||!/^txr_[A-Za-z0-9_]+$/.test(rate)))throw new Error('An inclusive Stripe TEST tax rate is required');
 return {tax_status:value as TaxStatus,tax_rate_id:value==='inclusive'?rate:null};
}

export function publicTaxStatus():TaxStatus {const value=process.env.COMMERCE_TAX_STATUS;return value==='inclusive'||value==='not_registered'?value:'unconfirmed';}
