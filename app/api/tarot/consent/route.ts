import {devTarotRpc} from '@/lib/commerce/db';
import {productionStore,siteUrl,isDemo} from '@/lib/tarot/runtime';
import {hashToken} from '@/lib/tarot/service';
export const runtime='nodejs';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(request.headers.get('origin')!==siteUrl())return Response.json({error:'Solicitare nepermisă.'},{status:403,headers});
 if(Number(request.headers.get('content-length')??0)>1024)return new Response(null,{status:413,headers});
 try{
  if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response(null,{status:415,headers});
  const reader=request.body?.getReader();if(!reader)throw new Error('Invalid');
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>1024){await reader.cancel();return new Response(null,{status:413,headers});}chunks.push(value);}
  const text=Buffer.concat(chunks).toString('utf8');
  const {token,action}=JSON.parse(text);
  if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token)||!['confirm','withdraw'].includes(action))throw new Error('Invalid');
  const params={p_token_hash:hashToken(token),p_action:action};
  const result=isDemo()?await devTarotRpc<{ok:boolean}>('tarot_marketing_choice',params):await productionStore().rpc<{ok:boolean}>('tarot_marketing_choice',params);
  return Response.json(result,{status:result.ok?200:400,headers});
 }catch{return Response.json({error:'Link invalid sau expirat.'},{status:400,headers});}
}
