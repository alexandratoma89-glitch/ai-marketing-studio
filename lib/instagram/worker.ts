import {INSTAGRAM_PUBLISHING_LOCKED} from '../runway/policy.ts';
import {randomUUID} from 'node:crypto';
import {decrypt,encrypt} from './security.ts';
import {InstagramApi,MetaError,tokenRequest} from './meta.ts';
import type {InstagramDb,Account,Reel} from './db.ts';
export async function publishNext(db:InstagramDb,transport:typeof fetch=fetch,options:{allowPublishingForTests?:boolean}={}){
 if(INSTAGRAM_PUBLISHING_LOCKED&&!(process.env.NODE_ENV!=='production'&&options.allowPublishingForTests===true))return {status:'locked_for_runway_test'};
 if(process.env.INSTAGRAM_PUBLISHING_ENABLED!=='true')return {status:'disabled'};
 let account=await db.command<Account|null>('account');if(!account||Date.parse(account.expires_at)<=Date.now())return {status:'reconnect_required'};
 let token=decrypt(account.token_cipher);
 // Long-lived tokens can only be refreshed after 24h; refresh well before expiry.
 if(Date.parse(account.expires_at)-Date.now()<7*86400000&&Date.now()-Date.parse(account.refreshed_at)>86400000){let refreshed;try{refreshed=await tokenRequest('https://graph.instagram.com/refresh_access_token',{grant_type:'ig_refresh_token',access_token:token},transport,'GET');}catch(error){if(error instanceof MetaError&&error.code==='reconnect_required'){await db.command('invalidate',{id:account.id});return {status:'reconnect_required'};}throw error;}if(!(refreshed.expires_in>86400))throw new Error('invalid_token_expiry');await db.command('connect',{id:account.id,username:account.username,cipher:encrypt(refreshed.access_token),expiresAt:new Date(Date.now()+refreshed.expires_in*1000).toISOString()});token=refreshed.access_token;}
 const linkLease=randomUUID(),pendingLink=await db.command<Reel|null>('claim_link',{lease:linkLease});
 if(pendingLink){try{const media=await new InstagramApi(token,transport).call(pendingLink.media_id!,{fields:'permalink'});const url=new URL(media.permalink);if(url.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(url.hostname))throw new MetaError('invalid_permalink');await db.command('permalink',{id:pendingLink.id,lease:linkLease,url:url.href});return {status:'permalink_recovered'};}catch{await db.command('error',{id:pendingLink.id,lease:linkLease,code:'permalink_lookup_failed',retryable:true});return {status:'recorded_error'};}}
 const lease=randomUUID(),reel=await db.command<Reel|null>('claim',{lease});if(!reel)return {status:'idle'};
 const save=<T=boolean>(action:string,data:Record<string,unknown>={})=>db.command<T>(action,{id:reel.id,lease,...data});
 const api=new InstagramApi(token,transport);
 try{
  if(!reel.container_id){const container=await api.call(`${account.id}/media`,{media_type:'REELS',video_url:reel.video_url,caption:reel.caption,share_to_feed:'true'},'POST');if(!/^\d+$/.test(String(container.id)))throw new MetaError('invalid_container');if(!await save('container',{containerId:String(container.id)}))return {status:'canceled'};reel.container_id=String(container.id);}
  const status=await api.call(reel.container_id,{fields:'status_code'});
  if(status.status_code==='IN_PROGRESS'){await save('wait');return {status:'processing'};}
  if(status.status_code!=='FINISHED')throw new MetaError(status.status_code==='PUBLISHED'?'container_already_published':'container_failed');
  // Persist intent first. If the response is lost, never repeat media_publish blindly.
  if(!await save('intent'))return {status:'canceled'};
  const result=await api.call(`${account.id}/media_publish`,{creation_id:reel.container_id},'POST');
  if(!/^\d+$/.test(String(result.id)))throw new MetaError('invalid_published_id');
  await save('published',{mediaId:String(result.id)});
  const media=await api.call(String(result.id),{fields:'permalink'});const url=new URL(media.permalink);if(url.protocol!=='https:'||!['www.instagram.com','instagram.com'].includes(url.hostname))throw new MetaError('invalid_permalink');
  await save('permalink',{url:url.href});return {status:'published'};
 }catch(error){const known=error instanceof MetaError;await save('error',{code:known?error.code:'storage_or_response_error',retryable:known&&error.retryable});if(known&&error.code==='reconnect_required')await db.command('invalidate',{id:account.id});return {status:'recorded_error'};}
}
