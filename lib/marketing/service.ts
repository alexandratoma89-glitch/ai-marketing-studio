import {randomUUID} from 'node:crypto';
export type MarketingDb={command:<T>(action:string,data?:Record<string,unknown>)=>Promise<T>};
export type Env=Record<string,string|undefined>;
export function requirements(env:Env=process.env):[string,boolean][]{return [
 ['MARKETING_DATABASE_READY',env.MARKETING_DATABASE_READY==='true'],['BREVO_MARKETING_ENABLED',env.BREVO_MARKETING_ENABLED==='true'],
 ['BREVO_MARKETING_API_KEY',!!env.BREVO_MARKETING_API_KEY?.trim()],['BREVO_MARKETING_LIST_ID',/^[1-9]\d*$/.test(env.BREVO_MARKETING_LIST_ID??'')],
 ['BREVO_MARKETING_WEBHOOK_SECRET',(env.BREVO_MARKETING_WEBHOOK_SECRET?.length??0)>=32],['CRON_SECRET',(env.CRON_SECRET?.length??0)>=32],
 ['BREVO_SENDER_EMAIL',/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BREVO_SENDER_EMAIL??'')],
 ['BUSINESS_OPERATOR_NAME',!!env.BUSINESS_OPERATOR_NAME?.trim()],['BUSINESS_CONTACT_EMAIL',/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BUSINESS_CONTACT_EMAIL??'')],
 ];}
export function enabled(env:Env=process.env){return requirements(env).every(([,ok])=>ok);}
export class BrevoMarketing{
 private env:Env;private transport:typeof fetch;
 constructor(env:Env=process.env,transport:typeof fetch=fetch){this.env=env;this.transport=transport;}
 async call(path:string,method='GET',body?:unknown){
  if(!enabled(this.env))throw new Error('marketing_not_configured');
  const response=await this.transport(`https://api.brevo.com/v3/${path}`,{method,headers:{'api-key':this.env.BREVO_MARKETING_API_KEY!.trim(),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});
  if(response.status===404&&method==='GET')return null;
  if(!response.ok)throw new Error(`marketing_provider_${response.status}`);
  return response.status===204?{}:response.json();
 }
 async add(email:string,firstName:string){
  const existing=await this.call(`contacts/${encodeURIComponent(email)}`);
  if(existing?.emailBlacklisted)return false;
  await this.call('contacts','POST',{email,attributes:{FIRSTNAME:firstName},listIds:[Number(this.env.BREVO_MARKETING_LIST_ID)],updateEnabled:true});return true;
 }
 async remove(email:string){
  const listId=Number(this.env.BREVO_MARKETING_LIST_ID),path=`contacts/${encodeURIComponent(email)}`;
  const contact=await this.call(path);if(!contact||!contact.listIds?.includes(listId))return;
  await this.call(`contacts/lists/${listId}/contacts/remove`,'POST',{emails:[email]});
  const after=await this.call(path);if(after?.listIds?.includes(listId))throw new Error('marketing_removal_unconfirmed');
 }
 async checkAudience(expected:string[]){
  const remaining=new Set(expected);let offset=0;
  while(offset<10000){
   const page=await this.call(`contacts/lists/${this.env.BREVO_MARKETING_LIST_ID}/contacts?limit=500&offset=${offset}`);
   if(!Array.isArray(page?.contacts))throw new Error('marketing_audience_unconfirmed');
   for(const contact of page.contacts){if(typeof contact.email!=='string'||!remaining.delete(contact.email.toLowerCase())||contact.emailBlacklisted)throw new Error('marketing_audience_mismatch');}
   offset+=page.contacts.length;
   if(page.contacts.length<500){if(remaining.size)throw new Error('marketing_audience_mismatch');return;}
  }
  throw new Error('marketing_audience_too_large');
 }
 async draft(subject:string,body:string,id:string){
  const footer=`${this.env.BUSINESS_OPERATOR_NAME} · ${this.env.BUSINESS_CONTACT_EMAIL}`;
  const html=`<html><body><h1>${escapeHtml(subject)}</h1>${body.split(/\n\s*\n/).map(p=>`<p>${escapeHtml(p).replaceAll('\n','<br>')}</p>`).join('')}<hr><p>${escapeHtml(footer)}</p><p><a href="{{ unsubscribe }}">Dezabonare / Unsubscribe</a> · <a href="https://www.thedivinework.com/ro/privacy">Confidențialitate</a> · <a href="https://www.thedivinework.com/en/privacy">Privacy</a></p></body></html>`;
  const result=await this.call('emailCampaigns','POST',{name:`Divine Works ${id}`,subject,sender:{name:'Divine Works',email:this.env.BREVO_SENDER_EMAIL},replyTo:this.env.BUSINESS_CONTACT_EMAIL,htmlContent:html,recipients:{listIds:[Number(this.env.BREVO_MARKETING_LIST_ID)]}});
  if(!Number.isSafeInteger(result?.id)||result.id<1)throw new Error('marketing_draft_uncertain');return result.id as number;
 }
}
export function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export async function sync(db:MarketingDb,provider:Pick<BrevoMarketing,'add'|'remove'>){
 const token=randomUUID();const claim=await db.command<{claimed:boolean}>('claim',{token});if(!claim.claimed)return {busy:true,processed:0};
 let processed=0,failed=0;
 try{
  const rows=await db.command<{id:string;email:string;first_name:string;desired:boolean}[]>('batch',{token});
  for(const row of rows){try{
   await db.command('attempt',{token,id:row.id});
   if(row.desired){if(!await provider.add(row.email,row.first_name)){await db.command('suppress',{email:row.email});await provider.remove(row.email);await db.command('applied',{token,id:row.id,synced:false});processed++;continue;}}
   else await provider.remove(row.email);
   await db.command('applied',{token,id:row.id,synced:row.desired});processed++;
  }catch{failed++;}}
  return {processed,failed,busy:false};
 }finally{await db.command('release',{token});}
}
export async function createDraft(db:MarketingDb,provider:Pick<BrevoMarketing,'draft'|'checkAudience'>,data:{id:string;subject:string;body:string}){
 const status=await db.command<{pending:number;eligible:number}>('status');
 if(status.pending||!status.eligible)throw new Error('sync_required');
 await provider.checkAudience(await db.command<string[]>('audience'));
 const reserved=await db.command<{reserved:boolean}>('draft_reserve',data);if(!reserved.reserved)throw new Error('draft_already_requested');
 try{const providerId=await provider.draft(data.subject,data.body,data.id);await db.command('draft_finish',{id:data.id,providerId});return {providerId};}
 catch{await db.command('draft_finish',{id:data.id});throw new Error('draft_uncertain');}
}
export function suppressionEvent(value:unknown){return typeof value==='string'&&['unsubscribe','unsubscribed','spam','complaint','hard_bounce','hardbounce','invalid','blocked'].includes(value.toLowerCase().replaceAll(' ','_'));}
