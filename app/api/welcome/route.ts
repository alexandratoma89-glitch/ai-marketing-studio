import {readJson,HttpError,noStore} from '@/lib/commerce/http';
import {isDemo,ipHash,siteUrl,verifyTurnstile} from '@/lib/tarot/runtime';
import {welcomeAvailable} from '@/lib/welcome/config';
import {welcomeDb} from '@/lib/welcome/db';
import {requestWelcome} from '@/lib/welcome/service';
import {sendWelcome} from '@/lib/welcome/email';
export const runtime='nodejs';export const maxDuration=30;
export async function POST(request:Request){try{
 const input=await readJson(request);if(!welcomeAvailable())throw new HttpError(503,'Oferta prin email nu este încă disponibilă. Te rugăm să revii.');
 await requestWelcome(await welcomeDb(),input,ipHash(request),isDemo()?async token=>token==='development-only':verifyTurnstile,sendWelcome,siteUrl());
 return Response.json({accepted:true,simulated:isDemo()},{headers:noStore});
 }catch(error){return Response.json({error:error instanceof HttpError?error.message:'Emailul nu este încă disponibil. Te rugăm să revii.'},{status:error instanceof HttpError?error.status:503,headers:noStore});}}
