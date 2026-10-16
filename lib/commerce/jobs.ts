import type {CommerceDb,Job,Order} from './types.ts';
import type {EmailProvider,Generator,Reading} from '../tarot/types.ts';
import {drawCard} from '../tarot/deck.ts';
import {buildEmail} from '../tarot/email.ts';
import {managementToken,marketingToken} from './safety.ts';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function processJobs(db:CommerceDb,deps:{email:EmailProvider;generator:Generator;origin:string;tokenSecret:string},limit=10){
 let processed=0;
 for(let i=0;i<Math.min(limit,25);i++){
  const job=await db.command<Job|null>('claim_job');if(!job)break;if(job.skip)continue;
  let sending=false;
  try{
   const order=await db.command<Order>('get_order',{id:job.order_id});
   const manage=`${deps.origin}/cont#token=${managementToken(order.id,deps.tokenSecret)}`;
   let subject='The Divine Work · Gestionarea solicitării',text=`Bună, ${order.firstName}!\n\nGestionează solicitarea folosind linkul personal (valabil 48 de ore): ${manage}`,html='';
   if(job.kind==='daily_reading'){
    const card=drawCard();const reading=await deps.generator.generate(card);
    const complete={card,reading};await db.command('update_job',{id:job.id,status:'generated',reading:complete});
    const message=buildEmail({id:job.id,email:order.email,firstName:order.firstName,createdAt:new Date().toISOString(),status:'generated',policyVersion:'2026-10-16.v1',marketingConsent:false,card,reading:reading as Reading},{siteUrl:deps.origin});
    subject=message.subject;text=message.text+`\n\nGestionare și anulare: ${manage}`;html=message.html.replace('</main>',`<p><a href="${escape(manage)}" style="color:#d2adf5">Gestionare și anulare abonament</a></p></main>`);
   }else if(job.kind==='booking_confirmed'){
    subject='Rezervarea ta de test este confirmată · The Divine Work';
    text=`Bună, ${order.firstName}!\n\nRezervare de TEST confirmată: ${new Date(order.startsAt!).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})} (Europe/Bucharest), 30 de minute, ${order.meeting_mode}.\nPreț de test: ${(order.amount/100).toFixed(2)} USD.\nParticipare: ${order.meetingUrl}\n\nLink personal pentru gestionare/anulare: ${manage}`;
   }else if(job.kind==='membership_welcome'){
    subject='Abonamentul tău de test · The Divine Work';text=`Bună, ${order.firstName}!\n\nAbonament de TEST: ${order.intro_discount?'primele 30 de zile gratuite, apoi 10 USD/lună':'10 USD/lună; perioada de probă a fost deja folosită'}. Lectura zilnică este pregătită după ora 08:00, Europe/Bucharest.\nAnulare și gestionare: ${manage}`;
   }else if(job.kind==='booking_cancelled'){
    subject='Anulare rezervare · The Divine Work';text=`Rezervarea de test a fost anulată. Starea rambursării se verifică separat în pagina personală: ${manage}`;
   }
   const consent=await db.command<{marketing_opt_in:boolean}>('get_consent',{id:order.id});
   if(consent.marketing_opt_in&&['booking_confirmed','membership_welcome'].includes(job.kind))text+=`\n\nAi cerut separat mesaje promoționale. Confirmă opțiunea (nu este necesară pentru serviciu): ${deps.origin}/tarot-gratuit/confirma#token=${marketingToken(order.id,deps.tokenSecret)}`;
   if(!html)html=`<html lang="ro"><body style="background:#100d17;color:#eadcf5;font-family:Arial;padding:30px"><h1>The Divine Work</h1><p style="white-space:pre-line">${escape(text)}</p><p><a href="${escape(manage)}" style="color:#c9a0eb">Gestionează solicitarea</a></p></body></html>`;
   sending=true;const sent=await deps.email.send({to:order.email,subject,text,html,requestId:job.id});
   await db.command('update_job',{id:job.id,status:sent.status,providerId:sent.id});processed++;
  }catch{await db.command('update_job',{id:job.id,status:sending?'uncertain':'failed',error:sending?'send_result_uncertain':'preparation_failed'});}
 }
 return {processed};
}
