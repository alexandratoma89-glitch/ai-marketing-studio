import {brevoFailureReason} from './brevo-readiness.ts';
import {brevoPayload} from './brevo.ts';
import type {EmailMessage,EmailProvider} from './types.ts';

type Env=Record<string,string|undefined>;
const email=(value:string|undefined)=>!!value&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
// The owner authorized free-reading delivery on 2026-11-15, excluding live paid services.
// The existing generic customer-email and live-commerce locks remain unchanged.
export const LIVE_FREE_READING_EMAIL_AUTHORIZED=true;
export function freeReadingEmailRequirements(env:Env=process.env):[string,boolean][]{return [
 ['FREE_READING_EMAIL_ENABLED',env.FREE_READING_EMAIL_ENABLED==='true'],
 ['FREE_READING_SENDER_VERIFIED',env.FREE_READING_SENDER_VERIFIED==='true'],
 ['BREVO_API_KEY',!!env.BREVO_API_KEY],
 ['BREVO_SENDER_EMAIL',email(env.BREVO_SENDER_EMAIL)],
 ['BREVO_REPLY_TO',email(env.BREVO_REPLY_TO)],
 ['BREVO_WEBHOOK_SECRET',(env.BREVO_WEBHOOK_SECRET?.length??0)>=32],
 ['BUSINESS_OPERATOR_NAME',!!env.BUSINESS_OPERATOR_NAME?.trim()],
 ['BUSINESS_CONTACT_EMAIL',email(env.BUSINESS_CONTACT_EMAIL)],
];}
export function freeReadingEmailConfigured(env:Env=process.env){return LIVE_FREE_READING_EMAIL_AUTHORIZED&&freeReadingEmailRequirements(env).every(([,ready])=>ready);}
export class FreeReadingEmailProvider implements EmailProvider{
 private env:Env;private transport:typeof fetch;
 constructor(env:Env=process.env,transport:typeof fetch=fetch){this.env=env;this.transport=transport;}
 async send(message:EmailMessage){
  if(this.env.NODE_ENV!=='production'||this.env.TAROT_EMAIL_MODE!=='live'||!freeReadingEmailConfigured(this.env))throw new Error('free_reading_email_not_ready');
  if(message.purpose!=='free_reading')throw new Error('free_reading_email_only');
  const response=await this.transport('https://api.brevo.com/v3/smtp/email',{
   method:'POST',headers:{'api-key':this.env.BREVO_API_KEY!.trim(),'Content-Type':'application/json'},
   body:JSON.stringify({...brevoPayload(message,this.env.BREVO_SENDER_EMAIL!,this.env.BREVO_REPLY_TO!),tags:['divineworks-free-reading']}),
   signal:AbortSignal.timeout(15000),redirect:'error',
  });
  if(!response.ok){const data=await response.json().catch(()=>null);console.error('free_reading_delivery_rejected',{providerStatus:response.status,reason:brevoFailureReason(response.status,data)});throw new Error('free_reading_delivery_unconfirmed');}
  const receipt=await response.json();
  if(typeof receipt.messageId!=='string'||!receipt.messageId.trim()||receipt.messageId.length>512)throw new Error('free_reading_delivery_unconfirmed');
  return {id:receipt.messageId,status:'provider_accepted' as const};
 }
}
