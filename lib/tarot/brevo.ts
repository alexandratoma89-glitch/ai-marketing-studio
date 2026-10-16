import type {EmailMessage,EmailProvider} from './types.ts';
import {MockEmailProvider} from './providers.ts';
import {LIVE_CUSTOMER_EMAIL_AUTHORIZED} from '../commerce/safety.ts';
export function brevoPayload(message:EmailMessage,sender:string,replyTo?:string){return {sender:{email:sender,name:'The Divine Work'},to:[{email:message.to}],subject:message.subject,htmlContent:message.html,textContent:message.text,...(replyTo?{replyTo:{email:replyTo}}:{}),tags:['divineworks-transactional'],headers:{'X-Mailin-custom':`request_id:${message.requestId}`}};}
export class BrevoEmailProvider implements EmailProvider {
 private mode:string;private key:string;private sender:string;private replyTo:string;
 constructor(mode='mock',key='',sender='',replyTo=''){this.mode=mode;this.key=key;this.sender=sender;this.replyTo=replyTo;}
 async send(message:EmailMessage){
  if(this.mode==='mock')return new MockEmailProvider().send(message);
  if(!LIVE_CUSTOMER_EMAIL_AUTHORIZED)throw new Error('Real customer email is disabled by owner instruction');
  if(this.mode!=='live'||!this.key||!this.sender)throw new Error('Brevo is not configured');
  const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':this.key,'Content-Type':'application/json'},body:JSON.stringify(brevoPayload(message,this.sender,this.replyTo)),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Brevo delivery failed');const data=await response.json();if(typeof data.messageId!=='string')throw new Error('Missing Brevo receipt');return {id:data.messageId,status:'provider_accepted' as const};
 }
}
