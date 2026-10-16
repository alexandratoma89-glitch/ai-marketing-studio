import type {Store,ReadingRequest,DeliveryStatus,Admission,Reading} from './types.ts';
// Development/test only. Production always uses the transactional Postgres RPC below.
export class MemoryStore implements Store {
 requests=new Map<string,ReadingRequest>();
 buckets=new Map<string,{count:number;at:number}>();
 async admit(request:ReadingRequest,ipHash:string):Promise<Admission>{
  const now=Date.parse(request.createdAt);
  for(const [key,v] of this.buckets)if(now-v.at>=3600000)this.buckets.delete(key);
  for(const [key,v] of this.requests)if(now-Date.parse(v.createdAt)>=172800000)this.requests.delete(key);
  const bucket=this.buckets.get(ipHash)??{count:0,at:now};bucket.count++;this.buckets.set(ipHash,bucket);
  if(bucket.count>5||[...this.requests.values()].filter(r=>now-Date.parse(r.createdAt)<86400000).length>=200)return {kind:'limited'};
  if([...this.requests.values()].some(r=>r.email===request.email&&now-Date.parse(r.createdAt)<86400000))return {kind:'duplicate'};
  this.requests.set(request.id,structuredClone(request));return {kind:'accepted',id:request.id};
 }
 async update(id:string,patch:{status:DeliveryStatus;reading?:Reading;providerId?:string}){const r=this.requests.get(id);if(!r)throw new Error('Unknown request');Object.assign(r,patch);}
}
export class SupabaseStore implements Store {
 private url:string;private key:string;
 constructor(url:string,key:string){this.url=url;this.key=key;}
 async rpc<T>(name:string,params:Record<string,unknown>):Promise<T>{
  const response=await fetch(`${this.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!response.ok)throw new Error(`Storage operation failed (${response.status})`);
  return response.json() as Promise<T>;
 }
 admit(request:ReadingRequest,ipHash:string){return this.rpc<Admission>('request_free_tarot',{p_id:request.id,p_first_name:request.firstName,p_email:request.email,p_marketing_consent:request.marketingConsent,p_policy_version:request.policyVersion,p_card:request.card,p_ip_hash:ipHash,p_token_hash:request.consentTokenHash??null});}
 async update(id:string,patch:{status:DeliveryStatus;reading?:Reading;providerId?:string}){await this.rpc('update_free_tarot',{p_id:id,p_status:patch.status,p_reading:patch.reading??null,p_provider_id:patch.providerId??null});}
}

export class DevelopmentTarotStore implements Store {
 async admit(request:ReadingRequest,ipHash:string){const {devTarotRpc}=await import('../commerce/db.ts');return devTarotRpc<Admission>('request_free_tarot',{p_id:request.id,p_first_name:request.firstName,p_email:request.email,p_marketing_consent:request.marketingConsent,p_policy_version:request.policyVersion,p_card:request.card,p_ip_hash:ipHash,p_token_hash:request.consentTokenHash??null});}
 async update(id:string,patch:{status:DeliveryStatus;reading?:Reading;providerId?:string}){const {devTarotRpc}=await import('../commerce/db.ts');await devTarotRpc('update_free_tarot',{p_id:id,p_status:patch.status,p_reading:patch.reading??null,p_provider_id:patch.providerId??null});}
}
