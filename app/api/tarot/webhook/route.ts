import {verifyWebhook} from '@/lib/tarot/webhook';
import {productionStore} from '@/lib/tarot/runtime';
export const runtime='nodejs';
export async function POST(request:Request){
 const secret=process.env.RESEND_WEBHOOK_SECRET;
 if(!secret)return new Response(null,{status:503});
 if(Number(request.headers.get('content-length')??0)>65536)return new Response(null,{status:413});
 const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
 const body=Buffer.concat(chunks).toString('utf8');
 if(!verifyWebhook(body,request.headers,secret))return new Response(null,{status:401});
 try{
  const event=JSON.parse(body);
  if(!['email.delivered','email.bounced'].includes(event.type))return new Response(null,{status:204});
  if(typeof event.data?.email_id!=='string'||!Number.isFinite(Date.parse(event.created_at)))return new Response(null,{status:400});
  await productionStore().rpc('record_tarot_delivery',{p_event_id:request.headers.get('svix-id'),p_provider_id:event.data.email_id,p_type:event.type,p_occurred_at:event.created_at});
  return new Response(null,{status:204});
 }catch{return new Response(null,{status:503});}
}
