import {emailConfigured} from '../launch/config.ts';
import {createHmac,randomBytes} from 'node:crypto';
import {MemoryStore,SupabaseStore} from './store.ts';
import {DemoGenerator,AiGenerator,MockEmailProvider,ResendEmailProvider,LIVE_EMAIL_AUTHORIZED} from './providers.ts';
import {PublicError} from './types.ts';
const globalState=globalThis as typeof globalThis & {tarotDevStore?:MemoryStore;tarotDevSalt?:string};
export function isDemo(){return process.env.NODE_ENV!=='production';}
export function siteUrl(){const url=new URL(process.env.TAROT_SITE_URL??'http://localhost:3000');if(!isDemo()&&url.protocol!=='https:')throw new Error('HTTPS site URL required');return url.origin;}
export function productionStore(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key||new URL(url).protocol!=='https:')throw new Error('Supabase configuration missing');return new SupabaseStore(url,key);}
export function assertAvailable(){
 if(isDemo())return;
 if(!LIVE_EMAIL_AUTHORIZED||!emailConfigured())throw new PublicError(503,'Lectura gratuită prin email nu este încă disponibilă. Te rugăm să revii.');
 productionStore();siteUrl();
}
export function getDeps(){
 assertAvailable();
 if(isDemo())return {store:globalState.tarotDevStore??(globalState.tarotDevStore=new MemoryStore()),generator:new DemoGenerator(),email:new MockEmailProvider(),verifyBot:async(token:string)=>token==='development-only',siteUrl:siteUrl()};
 return {store:productionStore(),generator:new AiGenerator(process.env.AI_API_KEY!,process.env.TAROT_AI_MODEL!),email:new ResendEmailProvider(process.env.RESEND_API_KEY!,process.env.TAROT_EMAIL_FROM!),verifyBot:verifyTurnstile,siteUrl:siteUrl()};
}
export function ipHash(request:Request){
 // On Vercel, this header is overwritten by the platform. Other production hosts must
 // provide an equivalent trusted address adapter, never trust user X-Forwarded-For.
 if(!isDemo()&&process.env.VERCEL!=='1')throw new PublicError(503,'Serviciul nu este configurat pentru această găzduire.');
 const ip=process.env.VERCEL==='1'?request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim(): 'local-development';
 if(!ip)throw new PublicError(503,'Verificarea de securitate nu este disponibilă.');
 const salt=process.env.TAROT_IP_HASH_SECRET??(globalState.tarotDevSalt??(globalState.tarotDevSalt=randomBytes(32).toString('hex')));
 return createHmac('sha256',salt).update(ip).digest('hex');
}
async function verifyTurnstile(token:string){
 try{const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY!,response:token}),signal:AbortSignal.timeout(8000)});if(!response.ok)return false;const data=await response.json();return data.success===true&&data.hostname===new URL(siteUrl()).hostname&&data.action==='free_tarot';}catch{return false;}
}

export function isReadingAvailable(){if(isDemo())return true;try{assertAvailable();return true;}catch{return false;}}
