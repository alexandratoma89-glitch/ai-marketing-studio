import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import type {Generator,Reading,EmailProvider,EmailMessage} from './types.ts';
import type {Card} from './deck.ts';
// Latest owner instruction keeps all customer email in test mode.
// Separate production activation and complete service configuration are still required.
export const LIVE_EMAIL_AUTHORIZED=false;
export class DemoGenerator implements Generator {
 async generate(card:Card):Promise<Reading>{return {source:'demo',meaning:`${card.name} aduce în prim-plan ${card.symbols}. În tradiția Rider–Waite–Smith, imaginile nu hotărăsc viitorul, ci deschid un spațiu în care îți poți observa propriile reacții. Privește simbolurile ca pe o invitație la reflecție, nu ca pe un verdict.`,guidance:`Acordă-ți astăzi câteva minute fără grabă. Observă ce temă din această carte se leagă de viața ta și notează un singur pas mic pe care îl poți face în acord cu valorile tale. Dacă o schimbare pare prea mare, începe cu ceea ce poți controla acum: un gând exprimat sincer, o limită blândă sau un moment de odihnă. Păstrează libertatea de a alege ce ți se potrivește.`,question:`Ce pas mic, inspirat de tema „${card.symbols.split(',')[0]}”, te-ar ajuta să te simți mai aproape de tine astăzi?`};}
}
export class AiGenerator implements Generator {
 private key:string;private model:string;
 constructor(key:string,model:string){this.key=key;this.model=model;}
 async generate(card:Card):Promise<Reading>{
  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,temperature:0.7,max_tokens:1000,response_format:{type:'json_object'},messages:[{role:'system',content:'Scrii interpretări de tarot în română, calde și atente, ca instrument de reflecție. Nu prezice evenimente certe, moarte, sarcină, diagnostice, câștiguri sau deciziile altei persoane. Nu oferi sfaturi medicale, juridice sau financiare. Nu cere bani, nu include linkuri sau HTML. Răspunde doar JSON cu exact trei texte: meaning (80-130 cuvinte, simboluri specifice cărții RWS), guidance (80-130 cuvinte, pași mici și autonomie), question (o singură întrebare de reflecție).'}, {role:'user',content:`Cartea extrasă în poziție dreaptă: ${card.name}. Teme: ${card.symbols}. Nu ai date personale despre destinatar.`}]}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error('AI generation failed');
  const result=await response.json();const content=JSON.parse(result.choices?.[0]?.message?.content??'null');
  for(const key of ['meaning','guidance','question'])if(!content||typeof content[key]!=='string'||content[key].length<15||content[key].length>3000||/[<>]/.test(content[key]))throw new Error('Invalid interpretation');
  if(content.question.length>400||!content.question.trim().endsWith('?'))throw new Error('Invalid question');
  return {meaning:content.meaning,guidance:content.guidance,question:content.question,source:'ai'};
 }
}
export class MockEmailProvider implements EmailProvider {
 async send(message:EmailMessage):Promise<{id:string;status:'mocked'}>{
  const path=join(tmpdir(),'arcana-private-outbox');await mkdir(path,{recursive:true,mode:0o700});
  await writeFile(join(path,`${message.requestId}.json`),JSON.stringify(message,null,2),{mode:0o600,flag:'wx'});
  return {id:`mock_${message.requestId}`,status:'mocked'};
 }
}
export class ResendEmailProvider implements EmailProvider {
 private key:string;private from:string;
 constructor(key:string,from:string){this.key=key;this.from=from;}
 async send(message:EmailMessage):Promise<{id:string;status:'provider_accepted'}>{
  if(!LIVE_EMAIL_AUTHORIZED||process.env.TAROT_EMAIL_ENABLED!=='true'||process.env.NODE_ENV!=='production')throw new Error('Real email is not enabled');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json','Idempotency-Key':`free-tarot/${message.requestId}`},body:JSON.stringify({from:this.from,to:[message.to],subject:message.subject,html:message.html,text:message.text}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Email API rejected request');
  const result=await response.json();if(typeof result.id!=='string')throw new Error('Missing provider receipt');
  return {id:result.id,status:'provider_accepted'};
 }
}
