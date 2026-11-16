import {HttpError,readJson,noStore} from '@/lib/commerce/http';
import {marketingDb} from '@/lib/marketing/db';
import {requirements,enabled,sync,createDraft,BrevoMarketing} from '@/lib/marketing/service';
export const runtime='nodejs';export const maxDuration=120;export const dynamic='force-dynamic';
export async function GET(){
 const settings=Object.fromEntries(requirements());
 try{return Response.json({settings,...(process.env.MARKETING_DATABASE_READY==='true'?await marketingDb().command<Record<string,unknown>>('status'): {})},{headers:noStore});}
 catch{return Response.json({settings,error:'Baza de date nu este pregătită. Aplică migrarea 016.'},{status:503,headers:noStore});}
}
export async function POST(request:Request){
 try{
  const input=await readJson(request,60000);if(!enabled())throw new HttpError(503,'Completează configurarea de marketing înainte de activare.');
  const db=marketingDb(),provider=new BrevoMarketing();
  if(input.action==='sync')return Response.json(await sync(db,provider),{headers:noStore});
  if(input.action!=='draft'||typeof input.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.id)||typeof input.subject!=='string'||typeof input.body!=='string'||!input.subject.trim()||input.subject.length>150||!input.body.trim()||input.body.length>12000)throw new HttpError(400,'Completează subiectul și mesajul.');
  return Response.json(await createDraft(db,provider,{id:input.id,subject:input.subject.trim(),body:input.body.trim()}),{headers:noStore});
 }catch(error){
  const message=error instanceof HttpError?error.message:error instanceof Error&&error.message==='sync_required'?'Sincronizează lista înainte de a crea campania. Lista trebuie să aibă cel puțin un abonat confirmat.':error instanceof Error&&['marketing_audience_mismatch','marketing_audience_unconfirmed','marketing_audience_too_large'].includes(error.message)?'Lista Brevo nu coincide cu abonații confirmați. Verifică ID-ul listei dedicate, elimină contactele importate manual și sincronizează din nou.':error instanceof Error&&['draft_uncertain','draft_already_requested'].includes(error.message)?'Cererea este deja înregistrată sau rezultatul este incert. Verifică în Brevo înainte de a crea altă campanie.':'Operațiunea nu a fost confirmată. Verifică setările și permisiunile cheii de marketing.';
  return Response.json({error:message},{status:error instanceof HttpError?error.status:503,headers:noStore});
 }
}
