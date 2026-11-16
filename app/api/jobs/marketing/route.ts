import {equalSecret} from '@/lib/commerce/safety';
import {noStore} from '@/lib/commerce/http';
import {marketingDb} from '@/lib/marketing/db';
import {enabled,sync,BrevoMarketing} from '@/lib/marketing/service';
export const runtime='nodejs';export const maxDuration=120;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32||!equalSecret(request.headers.get('authorization')??'',`Bearer ${secret}`))return new Response(null,{status:401,headers:noStore});
 if(!enabled())return Response.json({status:'disabled'},{headers:noStore});
 try{return Response.json(await sync(marketingDb(),new BrevoMarketing()),{headers:noStore});}catch{return Response.json({error:'marketing_sync_unavailable'},{status:503,headers:noStore});}
}
