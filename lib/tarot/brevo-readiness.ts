type Env=Record<string,string|undefined>;
export function brevoFailureReason(status:number,data:unknown){
 const message=data&&typeof data==='object'&&'message' in data?String(data.message).slice(0,2048):'';
 if(/unauthori[sz]ed ip|unrecogni[sz]ed ip|ip address/i.test(message))return 'ip_approval_required';
 if(status===401)return 'api_key_rejected';
 if(status===403)return 'provider_access_denied';
 if(status===429)return 'provider_rate_limited';
 return 'provider_unavailable';
}
/** Owner-only, read-only provider checks. Return no keys, sender addresses or raw errors. */
export async function brevoReadiness(env:Env=process.env,transport:typeof fetch=fetch){
 if(!env.BREVO_API_KEY)return {apiKeyConfigured:false,reason:'api_key_missing'};
 async function read(path:string){
  const response=await transport('https://api.brevo.com/v3/'+path,{headers:{'api-key':env.BREVO_API_KEY!},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  const data=await response.json().catch(()=>null);return {status:response.status,ok:response.ok,data};
 }
 try{
  const account=await read('account');
  if(!account.ok)return {apiKeyConfigured:true,accountStatus:account.status,reason:brevoFailureReason(account.status,account.data)};
  const senders=await read('senders');
  return {apiKeyConfigured:true,accountStatus:account.status,transactionalEnabled:typeof account.data?.relay?.enabled==='boolean'?account.data.relay.enabled:null,senderConfigured:!!env.BREVO_SENDER_EMAIL,senderCheckStatus:senders.status,senderActive:senders.ok?!!senders.data?.senders?.some((sender:{email?:string;active?:boolean})=>sender.email?.toLowerCase()===env.BREVO_SENDER_EMAIL?.toLowerCase()&&sender.active===true):null,reason:senders.ok?'connection_checked':brevoFailureReason(senders.status,senders.data)};
 }catch{return {apiKeyConfigured:true,reason:'provider_connection_failed'};}
}
