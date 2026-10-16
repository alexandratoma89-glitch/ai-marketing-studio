import {requestReading} from '@/lib/tarot/service';
import {getDeps,ipHash,siteUrl} from '@/lib/tarot/runtime';
import {PublicError} from '@/lib/tarot/types';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==siteUrl())throw new PublicError(403,'Solicitare nepermisă.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new PublicError(415,'Format neacceptat.');
  if(Number(request.headers.get('content-length')??0)>8192)throw new PublicError(413,'Formular prea mare.');
  const reader=request.body?.getReader();if(!reader)throw new PublicError(400,'Formular invalid.');
  const chunks:Uint8Array[]=[];let bytes=0;
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8192){await reader.cancel();throw new PublicError(413,'Formular prea mare.');}chunks.push(value);}
  let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PublicError(400,'Formular invalid.');}
  const result=await requestReading(value,ipHash(request),getDeps());
  return Response.json(result,{status:202,headers});
 }catch(error){const known=error instanceof PublicError;return Response.json({error:known?error.message:'Serviciul este temporar indisponibil. Încearcă mai târziu.'},{status:known?error.status:503,headers:{...headers,...(known&&error.status===429?{'Retry-After':'3600'}:{})}});}
}
