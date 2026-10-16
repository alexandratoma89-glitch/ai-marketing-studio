import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {drawCard} from './deck.ts';
import {buildEmail} from './email.ts';
import {parseSignup,PublicError,type Store,type Generator,type EmailProvider,type ReadingRequest} from './types.ts';
export const hashToken=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function requestReading(value:unknown, ipHash:string, deps:{store:Store;generator:Generator;email:EmailProvider;verifyBot:(token:string)=>Promise<boolean>;siteUrl:string;now?:()=>Date}) {
 const input=parseSignup(value);
 if(input.website||!(await deps.verifyBot(input.botToken)))throw new PublicError(400,'Verificarea de securitate nu a reușit. Încearcă din nou.');
 const token=input.marketingConsent?randomBytes(32).toString('hex'):undefined;
 const request:ReadingRequest={id:randomUUID(),firstName:input.firstName,email:input.email,marketingConsent:input.marketingConsent,policyVersion:input.policyVersion,card:drawCard(),status:'requested',createdAt:(deps.now?.()??new Date()).toISOString(),...(token?{consentTokenHash:hashToken(token)}:{})};
 const admitted=await deps.store.admit(request,ipHash);
 if(admitted.kind==='limited')throw new PublicError(429,'Prea multe solicitări. Încearcă din nou mai târziu.');
 // Identical public result for duplicate requests: no address enumeration or consent changes.
 if(admitted.kind==='duplicate')return {accepted:true as const};
 try {
  await deps.store.update(request.id,{status:'generating'});
  request.reading=await deps.generator.generate(request.card);
  await deps.store.update(request.id,{status:'generated',reading:request.reading});
 } catch {
  await deps.store.update(request.id,{status:'generation_failed'});
  throw new PublicError(503,'Interpretarea nu a putut fi pregătită. Echipa va putea verifica solicitarea; încearcă din nou mâine.');
 }
 try {
  const message=buildEmail(request,{siteUrl:deps.siteUrl,consentToken:token});
  const sent=await deps.email.send(message);
  // Provider acceptance is NOT inbox delivery. A verified webhook records final status.
  await deps.store.update(request.id,{status:sent.status,providerId:sent.id});
 } catch {
  await deps.store.update(request.id,{status:'email_failed'});
  throw new PublicError(503,'Trimiterea nu a putut fi confirmată. Nu retrimite formularul; solicitarea a fost păstrată pentru verificare.');
 }
 return {accepted:true as const};
}
