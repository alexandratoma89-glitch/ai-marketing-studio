/** Supabase clients require a project base URL, not a copied Data API endpoint. */
export function supabaseProjectUrl(value:unknown):string|null{
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value.trim());
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)return null;
  if(!['/','/rest/v1','/rest/v1/','/auth/v1','/auth/v1/'].includes(url.pathname))return null;
  return url.origin;
 }catch{return null;}
}
