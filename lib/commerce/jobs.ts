import {guide} from '../public/cards.ts';
import {formatMoney,taxNotice} from './pricing.ts';
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
   const manage=`${deps.origin}/${order.locale?order.locale+'/manage':'cont'}#token=${managementToken(order.id,deps.tokenSecret)}`;
   let subject='The Divine Work · Gestionarea solicitării',text=`Bună, ${order.firstName}!\n\nGestionează solicitarea folosind linkul personal (valabil 48 de ore): ${manage}`,html='';
   if(job.kind==='daily_reading'){
    const drawn=drawCard();const card=order.locale==='en'?{...drawn,name:guide(drawn.id)!.names.en,symbols:guide(drawn.id)!.keywords.en}:drawn;const reading=await deps.generator.generate(card,order.locale);
    const complete={card,reading};await db.command('update_job',{id:job.id,status:'generated',reading:complete});
    const message=buildEmail({id:job.id,email:order.email,firstName:order.firstName,createdAt:new Date().toISOString(),status:'generated',policyVersion:'2026-10-16.v1',marketingConsent:false,...(order.locale==='en'?{locale:'en' as const}:{}),card,reading:reading as Reading},{siteUrl:deps.origin,serviceLabel:order.locale==='en'?`Reading included in your ${formatMoney(order.amount,order.currency,'en')}/month membership. ${taxNotice(order.tax_status,'en')}`:`Lectură inclusă în abonamentul de ${formatMoney(order.amount,order.currency)}/lună. ${taxNotice(order.tax_status)}`});
    subject=message.subject;text=message.text+(order.locale==='en'?`\n\nManage or cancel: ${manage}`:`\n\nGestionare și anulare: ${manage}`);html=message.html.replace('</main>',`<p><a href="${escape(manage)}" style="color:#d2adf5">${order.locale==='en'?'Manage or cancel membership':'Gestionare și anulare abonament'}</a></p></main>`);
   }else if(job.kind==='booking_confirmed'){
    subject='Rezervarea ta de test este confirmată · The Divine Work';
    text=`Bună, ${order.firstName}!\n\nRezervare de TEST confirmată: ${new Date(order.startsAt!).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})} (Europe/Bucharest), 30 de minute, ${order.meeting_mode}.\nPreț de test: ${formatMoney(order.amount,order.currency)}. ${taxNotice(order.tax_status)}\nParticipare: ${order.meetingUrl}\n\nLink personal pentru gestionare/anulare: ${manage}`;
   }else if(job.kind==='membership_welcome'){
    subject='Abonamentul tău de test · The Divine Work';text=`Bună, ${order.firstName}!\n\nAbonament de TEST: ${order.intro_discount?`primele 30 de zile gratuite (0 lei), apoi ${formatMoney(order.amount,order.currency)}/lună`:`${formatMoney(order.amount,order.currency)}/lună; perioada de probă a fost deja folosită`}. ${taxNotice(order.tax_status)} Lectura zilnică este pregătită după ora 08:00, Europe/Bucharest.\nAnulare și gestionare: ${manage}`;
   }else if(job.kind==='booking_cancelled'){
    subject='Anulare rezervare · The Divine Work';text=`Rezervarea de test a fost anulată. Valoarea rezervării: ${formatMoney(order.amount,order.currency)}. Starea rambursării se verifică separat în pagina personală: ${manage}`;
   }
   if(order.locale==='en'&&job.kind!=='daily_reading'){
    const money=formatMoney(order.amount,order.currency,'en'),tax=taxNotice(order.tax_status,'en');
    subject='Divine Works · Manage your request';text=`Hello, ${order.firstName}!\n\nUse your personal link to manage your request (valid for 48 hours): ${manage}`;
    if(job.kind==='booking_confirmed'){subject='Your test booking is confirmed · Divine Works';text=`Hello, ${order.firstName}!\n\nTEST booking confirmed: ${new Date(order.startsAt!).toLocaleString('en-GB',{timeZone:'Europe/Bucharest'})} (Europe/Bucharest), 30 minutes, ${order.meeting_mode==='audio'?'audio':'video'}.\nTest price: ${money}. ${tax}\nJoin: ${order.meetingUrl}\n\nManage or cancel: ${manage}`;}
    else if(job.kind==='membership_welcome'){subject='Your test membership · Divine Works';text=`Hello, ${order.firstName}!\n\nTEST membership: ${order.intro_discount?`first 30 days free (0 RON), then ${money}/month`:`${money}/month; your trial has already been used`}. ${tax} Daily readings are prepared after 08:00 Europe/Bucharest.\nManage or cancel: ${manage}`;}
    else if(job.kind==='booking_cancelled'){subject='Booking cancellation · Divine Works';text=`Your test booking has been cancelled. Booking value: ${money}. Check the refund status separately using your personal page: ${manage}`;}
   }
   const consent=await db.command<{marketing_opt_in:boolean}>('get_consent',{id:order.id});
   if(consent.marketing_opt_in&&['booking_confirmed','membership_welcome'].includes(job.kind))text+=order.locale==='en'?`\n\nYou separately requested promotional emails. Confirm this choice (not required for your service): ${deps.origin}/en/confirm#token=${marketingToken(order.id,deps.tokenSecret)}`:`\n\nAi cerut separat mesaje promoționale. Confirmă opțiunea (nu este necesară pentru serviciu): ${deps.origin}/tarot-gratuit/confirma#token=${marketingToken(order.id,deps.tokenSecret)}`;
   if(!html)html=`<html lang="${order.locale??'ro'}"><body style="background:#100d17;color:#eadcf5;font-family:Arial;padding:30px"><h1>The Divine Work</h1><p style="white-space:pre-line">${escape(text)}</p><p><a href="${escape(manage)}" style="color:#c9a0eb">${order.locale==='en'?'Manage your request':'Gestionează solicitarea'}</a></p></body></html>`;
   sending=true;const sent=await deps.email.send({to:order.email,subject,text,html,requestId:job.id});
   await db.command('update_job',{id:job.id,status:sent.status,providerId:sent.id});processed++;
  }catch{await db.command('update_job',{id:job.id,status:sending?'uncertain':'failed',error:sending?'send_result_uncertain':'preparation_failed'});}
 }
 return {processed};
}
