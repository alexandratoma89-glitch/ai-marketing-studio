import {equalSecret} from '@/lib/commerce/safety';
import {readBody,noStore} from '@/lib/commerce/http';
import {marketingDb} from '@/lib/marketing/db';
import {suppressionEvent} from '@/lib/marketing/service';
export const runtime='nodejs';
export async function POST(request:Request){
 const secret=process.env.BREVO_MARKETING_WEBHOOK_SECRET;
 if(!secret||secret.length<32||!equalSecret(request.headers.get('authorization')??'',`Bearer ${secret}`))return new Response(null,{status:401,headers:noStore});
 try{
  const event=JSON.parse(await readBody(request,16384));
  if(!suppressionEvent(event.event))return new Response(null,{status:204,headers:noStore});
  if(typeof event.email!=='string'||event.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.email))return new Response(null,{status:400,headers:noStore});
  await marketingDb().command('suppress',{email:event.email});
  return new Response(null,{status:204,headers:noStore});
 }catch{return Response.json({error:'marketing_event_unavailable'},{status:503,headers:noStore});}
}
