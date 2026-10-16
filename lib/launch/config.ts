type Env=Record<string,string|undefined>;
export function httpsLink(raw:string|undefined):string|undefined{try{const url=new URL(raw??'');if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}return undefined;}
export function emailRequirements(env:Env=process.env){
 return [['TAROT_SITE_URL',!!httpsLink(env.TAROT_SITE_URL)],['SUPABASE_URL',!!httpsLink(env.SUPABASE_URL)],['SUPABASE_SERVICE_ROLE_KEY',!!env.SUPABASE_SERVICE_ROLE_KEY],['TAROT_DATABASE_READY',env.TAROT_DATABASE_READY==='true'],['TAROT_IP_HASH_SECRET',(env.TAROT_IP_HASH_SECRET?.length??0)>=32],['TURNSTILE_SECRET_KEY',!!env.TURNSTILE_SECRET_KEY],['NEXT_PUBLIC_TURNSTILE_SITE_KEY',!!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY],['TAROT_PRIVACY_READY',env.TAROT_PRIVACY_READY==='true'],['TAROT_EMAIL_MODE',env.TAROT_EMAIL_MODE==='mock']] as [string,boolean][];
}
export function emailConfigured(env:Env=process.env){return emailRequirements(env).every(([,ready])=>ready);}
export function bookingLink(env:Env=process.env){return env.COMMERCE_MODE==='test'&&env.COMMERCE_DATABASE_READY==='true'&&env.STRIPE_SECRET_KEY?.startsWith('sk_test_')?'/tarot-gratuit/rezervare':undefined;}
// Fulfillment is implemented for TEST use only. Live customer emails and charges remain source-locked.
export const DAILY_SUBSCRIPTION_READY=true;
export function subscriptionLink(env:Env=process.env){return bookingLink(env)?'/tarot-gratuit/abonament':undefined;}
