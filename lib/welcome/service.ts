import {randomUUID} from 'node:crypto';
import {HttpError} from '../commerce/http.ts';
import {validEmail,WELCOME_POLICY} from './policy.ts';
import {welcomeEmail} from './email.ts';
import type {WelcomeDb} from './db.ts';
import type {EmailProvider} from '../tarot/types.ts';
export async function requestWelcome(db:WelcomeDb,value:unknown,ipHash:string,verify:(token:string)=>Promise<boolean>,send:EmailProvider['send'],origin:string){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'Formular invalid.');
 const input=value as Record<string,unknown>;
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
 if(!validEmail(email))throw new HttpError(400,'Introdu o adresă de email validă.');
 if(input.policyVersion!==WELCOME_POLICY||input.requested!==true)throw new HttpError(400,'Confirmă solicitarea ofertei prin email.');
 if(typeof input.botToken!=='string'||input.botToken.length>4096||typeof input.website!=='string'||input.website.length>200||input.website||!await verify(input.botToken))throw new HttpError(400,'Verificarea de securitate nu a reușit. Reîncarcă pagina.');
 const id=randomUUID(),admission=await db.command('reserve',{id,email,ipHash,policyVersion:WELCOME_POLICY});
 if(admission.kind==='limited')throw new HttpError(429,'Prea multe solicitări. Încearcă din nou mai târziu.');
 if(admission.kind==='duplicate')return {accepted:true};
 if(admission.kind!=='accepted')throw new Error('welcome_reservation_failed');
 const job=await db.command('claim',{id});if(!job)throw new Error('welcome_claim_failed');
 try{const receipt=await send(welcomeEmail(job.email,id,origin));await db.command('finish',{id,status:receipt.status,providerId:receipt.id});}
 catch{await db.command('finish',{id,status:'uncertain'}).catch(()=>{});throw new HttpError(503,'Trimiterea nu a putut fi confirmată. Nu retrimitem automat pentru a evita mesaje duplicate.');}
 return {accepted:true};
}
