import {validEmail} from './policy.ts';
export function welcomeChecks(env:Record<string,string|undefined>=process.env):[string,boolean][]{return [
 ['WELCOME_EMAIL_ENABLED',env.WELCOME_EMAIL_ENABLED==='true'],['WELCOME_DATABASE_READY',env.WELCOME_DATABASE_READY==='true'],
 ['SUPABASE_URL',!!env.SUPABASE_URL?.startsWith('https://')],['SUPABASE_SERVICE_ROLE_KEY',!!env.SUPABASE_SERVICE_ROLE_KEY],
 ['TAROT_SITE_URL',env.TAROT_SITE_URL==='https://www.thedivinework.com'],['TAROT_IP_HASH_SECRET',(env.TAROT_IP_HASH_SECRET?.length??0)>=32],
 ['BREVO_API_KEY',!!env.BREVO_API_KEY],['BREVO_SENDER_EMAIL',validEmail(env.BREVO_SENDER_EMAIL??'')],
 ['WELCOME_PRIVACY_READY',env.WELCOME_PRIVACY_READY==='true'],['BUSINESS_OPERATOR_NAME',!!env.BUSINESS_OPERATOR_NAME?.trim()],['BUSINESS_CONTACT_EMAIL',validEmail(env.BUSINESS_CONTACT_EMAIL??'')],
 ['WELCOME_SENDER_VERIFIED',env.WELCOME_SENDER_VERIFIED==='true'],['BREVO_REPLY_TO',validEmail(env.BREVO_REPLY_TO??'')],
 ['TURNSTILE_SECRET_KEY',!!env.TURNSTILE_SECRET_KEY],['NEXT_PUBLIC_TURNSTILE_SITE_KEY',!!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY]
 ];}
export function welcomeAvailable(){return process.env.NODE_ENV!=='production'||welcomeChecks().every(([,ready])=>ready);}
