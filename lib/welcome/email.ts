import {brevoPayload} from '../tarot/brevo.ts';
import {MockEmailProvider} from '../tarot/providers.ts';
import type {EmailMessage} from '../tarot/types.ts';
import {isDemo} from '../tarot/runtime.ts';
import {welcomeAvailable} from './config.ts';
export function welcomeEmail(email:string,id:string,origin:string):EmailMessage{
 const booking=new URL('/tarot-gratuit/rezervare',origin).href;
 const privacy=new URL('/tarot-gratuit/confidentialitate',origin).href;
 const text=`Bună! ✨\n\nAi solicitat oferta de bun venit The Divine Work: 10% reducere la prima lectură privată eligibilă.\n\nO ședință de 30 de minute: 179 lei → 161,10 lei. Folosește aceeași adresă de email la rezervare. Reducerea se verifică și se aplică automat la prima rezervare eligibilă; nu ai nevoie de un cod. Nu se cumulează cu alte reduceri și nu se aplică abonamentului.\n\nAlege un interval: ${booking}\n\nRezervările pot fi încă în modul test; verifică disponibilitatea și modul afișate pe pagina de rezervare înainte de a continua. Acest email nu confirmă o rezervare sau o plată.\n\nAi cerut doar acest email. Nu te-am abonat la newsletter. Pentru întrebări, răspunde acestui mesaj.\n\nConfidențialitate: ${privacy}`;
 const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 return {to:email,requestId:id,subject:'Bun venit ✨ 10% pentru prima ta lectură privată',text,html:`<!doctype html><html lang="ro"><body style="background:#100c18;color:#ede4f6;font-family:Arial,sans-serif;padding:32px"><main style="max-width:560px;margin:auto"><p style="color:#d1afe8">✧ THE DIVINE WORK</p><h1>Un bun venit, pentru tine.</h1>${text.split('\n\n').map(p=>`<p style="line-height:1.7;white-space:pre-line">${escape(p)}</p>`).join('')}<p><a style="color:#d1afe8" href="${escape(booking)}">Descoperă lectura privată →</a></p></main></body></html>`};
}
// Scoped authorization for user-requested welcome emails only. Other email flows stay unchanged.
export async function sendWelcome(message:EmailMessage,transport:typeof fetch=fetch){
 if(isDemo())return new MockEmailProvider().send(message);
 if(!welcomeAvailable())throw new Error('welcome_not_ready');
 const response=await transport('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':process.env.BREVO_API_KEY!,'Content-Type':'application/json'},body:JSON.stringify(brevoPayload(message,process.env.BREVO_SENDER_EMAIL!,process.env.BREVO_REPLY_TO!)),signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw new Error('welcome_delivery_unconfirmed');const result=await response.json();if(typeof result.messageId!=='string'||!result.messageId)throw new Error('welcome_delivery_unconfirmed');return {id:result.messageId,status:'provider_accepted' as const};
}
