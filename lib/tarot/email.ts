import {formatMoney,FREE_READING_BANI} from '../commerce/pricing.ts';
import type {ReadingRequest, EmailMessage} from './types.ts';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function buildEmail(request:ReadingRequest, config:{siteUrl:string;consentToken?:string;serviceLabel?:string}):EmailMessage {
 if(!request.reading)throw new Error('Reading required');
 const {reading,card}=request;
 const image=new URL(card.image,config.siteUrl).href;
 const confirm=config.consentToken?`${config.siteUrl}/tarot-gratuit/confirma#token=${config.consentToken}`:undefined;
 const serviceLabel=config.serviceLabel??`Costul lecturii gratuite: ${formatMoney(FREE_READING_BANI)}.`;
 const text=[serviceLabel,`Bună, ${request.firstName}!`, `Cartea ta: ${card.name}`,`Ilustrație Rider–Waite–Smith: ${image}`,`Semnificație simbolică: ${reading.meaning}`,`Îndrumare: ${reading.guidance}`,`Întrebare de reflecție: ${reading.question}`,'Tarotul este un instrument de reflecție, nu o predicție sigură sau un substitut pentru sfaturi medicale, juridice ori financiare.',...(confirm?[`Ai solicitat mesaje promoționale. Confirmă că adresa îți aparține: ${confirm}. Linkul expiră în 48 de ore. Fără confirmare, nu te înscriem.`]:[])].join('\n\n');
 // Requested transactional content is separate from marketing. Offers are on the thank-you page;
 // include them in email only after a separately established promotional basis, never on signup alone.
 const html=`<!doctype html><html lang="ro"><body style="margin:0;background:#100c18;color:#ede4f6;font-family:Arial,sans-serif"><main style="max-width:580px;margin:0 auto;padding:36px 24px"><p style="color:#c4a1e7;letter-spacing:3px">THE DIVINE WORK · UN MOMENT PENTRU TINE</p><h1>Bună, ${escape(request.firstName)}!</h1><h2>${escape(card.name)}</h2><p>${escape(serviceLabel)}</p><img src="${escape(image)}" alt="${escape(card.name)} — ilustrație Rider–Waite–Smith de Pamela Colman Smith" width="240" style="max-width:100%;border-radius:12px"/><h3>Semnificație simbolică</h3><p>${escape(reading.meaning)}</p><h3>Îndrumare</h3><p>${escape(reading.guidance)}</p><h3>Întrebare de reflecție</h3><p>${escape(reading.question)}</p><p style="color:#b9a9c7;font-size:12px">Tarotul este un instrument de reflecție, nu o predicție sigură sau un substitut pentru sfaturi medicale, juridice ori financiare.</p>${confirm?`<hr/><p>Ai solicitat separat mesaje promoționale. Pentru a confirma că adresa îți aparține, <a style="color:#d2adf5" href="${escape(confirm)}">confirmă înscrierea</a>. Linkul expiră în 48 de ore. Fără confirmare, nu te înscriem.</p>`:''}</main></body></html>`;
 return {to:request.email,subject:`Cartea ta de tarot: ${card.name}`,html,text,requestId:request.id};
}
