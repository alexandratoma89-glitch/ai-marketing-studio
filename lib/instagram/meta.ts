import {scopes} from './security.ts';
export class MetaError extends Error {code:string;retryable:boolean;constructor(code:string,retryable=false){super(code);this.code=code;this.retryable=retryable;}}
export class InstagramApi {
 private token:string;private transport:typeof fetch;private version:string;
 constructor(token:string,transport:typeof fetch=fetch,version=process.env.INSTAGRAM_GRAPH_VERSION??'v24.0'){this.token=token;this.transport=transport;this.version=version;}
 async call(path:string,params:Record<string,string>={},method='GET'):Promise<any>{if(!/^v\d+\.\d+$/.test(this.version)||!/^\d+(?:\/(?:media|media_publish))?$/.test(path)&&path!=='me')throw new MetaError('invalid_api_path');const url=new URL(`https://graph.instagram.com/${this.version}/${path}`);if(method==='GET')for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);let r:Response;try{r=await this.transport(url,{method,headers:{Authorization:`Bearer ${this.token}`,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:method==='POST'?new URLSearchParams(params):undefined,signal:AbortSignal.timeout(15000),cache:'no-store'});}catch{throw new MetaError('network_error',true);}let data;try{data=await r.json();}catch{throw new MetaError('invalid_meta_response',true);}if(!r.ok||data.error){const code=Number(data.error?.code);throw new MetaError(code===190?'reconnect_required':`meta_${code||r.status}`,r.status===429||r.status>=500||data.error?.is_transient===true);}return data;}
 async identity(){const me=await this.call('me',{fields:'user_id,username,account_type'});if(!/^\d+$/.test(String(me.user_id??me.id))||typeof me.username!=='string'||!['BUSINESS','MEDIA_CREATOR','CREATOR'].includes(me.account_type))throw new MetaError('professional_account_required');return {id:String(me.user_id??me.id),username:me.username};}

}
export async function tokenRequest(url:string,params:Record<string,string>,transport:typeof fetch=fetch,method='POST'){const target=new URL(url);if(method==='GET')for(const [k,v] of Object.entries(params))target.searchParams.set(k,v);const r=await transport(target,{method,body:method==='POST'?new URLSearchParams(params):undefined,signal:AbortSignal.timeout(15000),cache:'no-store'});const data=await r.json();if(!r.ok||typeof data.access_token!=='string')throw new MetaError(Number(data.error?.code)===190?'reconnect_required':'token_exchange_failed',r.status>=500||r.status===429);return data as {access_token:string;expires_in:number;permissions?:unknown};}

// Read grants from the server-to-server authorization-code exchange, never browser input.
export function verifyGrantedPermissions(value:unknown){
 const values=typeof value==='string'?value.split(',').map(v=>v.trim()).filter(Boolean):Array.isArray(value)?value:[];
 if(!values.length)throw new MetaError('permission_grants_unavailable');
 const granted=new Set(values.filter((v):v is string=>typeof v==='string'));
 if(scopes.some(scope=>!granted.has(scope)))throw new MetaError('missing_permissions');
}
