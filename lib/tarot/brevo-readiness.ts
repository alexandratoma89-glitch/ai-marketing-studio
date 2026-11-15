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
 const results=await Promise.allSettled([read('smtp/statistics/aggregatedReport?days=1'),read('account'),read('senders')]);
 const [transactional,account,senders]=results.map(result=>result.status==='fulfilled'?result.value:null);
 if(!transactional&&!account&&!senders)return {apiKeyConfigured:true,keyFormat,reason:'provider_connection_failed'};
 const accepted=[transactional,account,senders].some(result=>result?.ok);
 const rejected=[transactional,account,senders].every(result=>result?.status===401);
 const reason=transactional?.ok?(account?.ok&&senders?.ok?'connection_checked':'transactional_api_checked'):transactional?(accepted&&[401,403].includes(transactional.status)?'transactional_permission_required':brevoFailureReason(transactional.status,transactional.data)):'transactional_check_unavailable';
 return {apiKeyConfigured:true,keyFormat,apiKeyAccepted:accepted?true:rejected?false:null,transactionalApiStatus:transactional?.status??null,accountStatus:account?.status??null,transactionalEnabled:typeof account?.data?.relay?.enabled==='boolean'?account.data.relay.enabled:null,senderConfigured:!!env.BREVO_SENDER_EMAIL,senderCheckStatus:senders?.status??null,senderActive:senders?.ok?!!senders.data?.senders?.some((sender:{email?:string;active?:boolean})=>sender.email?.toLowerCase()===env.BREVO_SENDER_EMAIL?.toLowerCase()&&sender.active===true):null,providerCode:transactional&&!transactional.ok?providerCode(transactional.data):null,reason};
}
