type Env=Record<string,string|undefined>;
export function httpsLink(raw:string|undefined):string|undefined{try{const url=new URL(raw??'');if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}return undefined;}
export function emailRequirements(env:Env=process.env){
 return [
 ['TAROT_SITE_URL',!!httpsLink(env.TAROT_SITE_URL)],
 ['SUPABASE_URL',!!httpsLink(env.SUPABASE_URL)],
 ['SUPABASE_SERVICE_ROLE_KEY',!!env.SUPABASE_SERVICE_ROLE_KEY],
 ['TAROT_DATABASE_READY',env.TAROT_DATABASE_READY==='true'],
 ['TAROT_IP_HASH_SECRET',(env.TAROT_IP_HASH_SECRET?.length??0)>=32],
 ['TURNSTILE_SECRET_KEY',!!env.TURNSTILE_SECRET_KEY],
 ['NEXT_PUBLIC_TURNSTILE_SITE_KEY',!!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY],
 ['AI_API_KEY',!!env.AI_API_KEY],['TAROT_AI_MODEL',!!env.TAROT_AI_MODEL],
 ['RESEND_API_KEY',!!env.RESEND_API_KEY],['TAROT_EMAIL_FROM',!!env.TAROT_EMAIL_FROM],
 ['RESEND_WEBHOOK_SECRET',!!env.RESEND_WEBHOOK_SECRET],
 ['TAROT_PRIVACY_READY',env.TAROT_PRIVACY_READY==='true'],
 ['TAROT_AI_ENABLED',env.TAROT_AI_ENABLED==='true'],
 ['TAROT_EMAIL_ENABLED',env.TAROT_EMAIL_ENABLED==='true'],
 ] as [string,boolean][];
}
export function emailConfigured(env:Env=process.env){return emailRequirements(env).every(([,ready])=>ready);}
export function bookingLink(env:Env=process.env){return env.TAROT_BOOKING_ENABLED==='true'&&env.TAROT_BOOKING_VERIFIED==='true'?httpsLink(env.TAROT_BOOKING_URL):undefined;}
// Recurring charges stay unavailable until daily fulfillment and cancellation are implemented.
export const DAILY_SUBSCRIPTION_READY=false;
export function subscriptionLink(env:Env=process.env){return DAILY_SUBSCRIPTION_READY&&env.TAROT_SUBSCRIPTION_ENABLED==='true'?httpsLink(env.TAROT_SUBSCRIPTION_URL):undefined;}
