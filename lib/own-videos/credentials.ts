import {decrypt,encrypt} from '../instagram/security.ts';import {key} from '../social/oauth.ts';import type {OwnDb} from './db.ts';import type {Platform} from './policy.ts';
export interface Credential{id:string;cipher:string;expiresAt:string;scopes:string[]}
export const requiredScopes:Record<Platform,string[]>={instagram:['instagram_business_basic','instagram_business_content_publish'],facebook:['pages_show_list','pages_read_engagement','pages_manage_posts'],youtube:['https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/youtube.upload']};
export async function account(db:OwnDb,p:Platform){return db.command<Credential|null>('credential',{provider:p});}
export async function access(db:OwnDb,p:Platform,expectedId:string,transport:typeof fetch=fetch){
 const c=await account(db,p);if(!c||c.id!==expectedId)throw new Error('account_changed');if(requiredScopes[p].some(scope=>!c.scopes.includes(scope)))throw new Error('publishing_permission_missing');
 if(p==='instagram'){
  let token=decrypt(c.cipher);if(Date.parse(c.expiresAt)<=Date.now())throw new Error('reconnect_required');
  if(Date.parse(c.expiresAt)<Date.now()+7*86400000){const url=new URL('https://graph.instagram.com/refresh_access_token');url.search=new URLSearchParams({grant_type:'ig_refresh_token',access_token:token}).toString();const r=await transport(url,{signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'}),data=await r.json();if(!r.ok||typeof data.access_token!=='string'||!(data.expires_in>86400))throw new Error('reconnect_required');token=data.access_token;await db.command('refresh',{provider:p,accountId:c.id,cipher:encrypt(token),expiresAt:new Date(Date.now()+data.expires_in*1000).toISOString()});}return token;
 }
 const stored=JSON.parse(decrypt(c.cipher,key()));if(typeof stored.accessToken!=='string')throw new Error('reconnect_required');
 if(p==='youtube'&&Date.parse(c.expiresAt)<Date.now()+120000){if(!stored.refreshToken)throw new Error('reconnect_required');const r=await transport('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',refresh_token:stored.refreshToken,client_id:process.env.GOOGLE_CLIENT_ID??'',client_secret:process.env.GOOGLE_CLIENT_SECRET??''}),signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'}),data=await r.json();if(!r.ok||typeof data.access_token!=='string'||!(data.expires_in>0))throw new Error('reconnect_required');stored.accessToken=data.access_token;await db.command('refresh',{provider:p,accountId:c.id,cipher:encrypt(JSON.stringify(stored),key()),expiresAt:new Date(Date.now()+data.expires_in*1000).toISOString()});}
 return stored.accessToken as string;
}
