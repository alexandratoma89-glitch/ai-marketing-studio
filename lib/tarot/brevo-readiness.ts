type Env=Record<string,string|undefined>;
export function brevoFailureReason(status:number,data:unknown){
 const message=data&&typeof data==='object'&&'message' in data?String(data.message).slice(0,2048):'';
 if(/unauthori[sz]ed ip|unrecogni[sz]ed ip|ip address/i.test(message))return 'ip_approval_required';
 if(/permission|insufficient scope|not authorized to access/i.test(message))return 'api_key_permissions';
 if(status===401)return 'api_key_rejected';
 if(status===403)return 'provider_access_denied';
 if(status===429)return 'provider_rate_limited';
 return 'provider_unavailable';
}
function providerCode(data:unknown){
 const code=data&&typeof data==='object'&&'code' in data?data.code:'';
 return ['unauthorized','permission_denied','invalid_api_key','key_not_found','unauthorized_ip','not_enough_credits','account_suspended','forbidden','invalid_parameter','too_many_requests'].includes(String(code))?code:'unclassified';
}
/** Owner-only read checks. No keys, addresses, IPs, account data or raw errors are returned. */
export async function brevoReadiness(env:Env=process.env,transport:typeof fetch=fetch){
 const raw=env.BREVO_API_KEY??'',key=raw.trim();
 if(!key)return {apiKeyConfigured:false,reason:'api_key_missing'};
 const keyFormat={kind:key.startsWith('xkeysib-')?'brevo_api_key':key.startsWith('xsmtpsib-')?'smtp_key':'unrecognized_format',characters:key.length,hasExtraWhitespace:raw!==key,looksMasked:/[•*]|\.\.\./.test(key),hasWrappingQuotes:/^["']|["']$/.test(key)};
 async function read(path:string){
  const response=await transport('https://api.brevo.com/v3/'+path,{headers:{'api-key':key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  const data=await response.json().catch(()=>null);return {status:response.status,ok:response.ok,data};
 }
 try{
  const account=await read('account'),senders=await read('senders');
  const failure=!account.ok?account:!senders.ok?senders:null;
  return {apiKeyConfigured:true,keyFormat,apiKeyAccepted:account.ok||senders.ok,accountStatus:account.status,transactionalEnabled:typeof account.data?.relay?.enabled==='boolean'?account.data.relay.enabled:null,senderConfigured:!!env.BREVO_SENDER_EMAIL,senderCheckStatus:senders.status,senderActive:senders.ok?!!senders.data?.senders?.some((sender:{email?:string;active?:boolean})=>sender.email?.toLowerCase()===env.BREVO_SENDER_EMAIL?.toLowerCase()&&sender.active===true):null,providerCode:failure?providerCode(failure.data):null,reason:account.ok&&senders.ok?'connection_checked':senders.ok?'account_read_restricted':brevoFailureReason((failure??senders).status,(failure??senders).data)};
 }catch{return {apiKeyConfigured:true,keyFormat,reason:'provider_connection_failed'};}
}
