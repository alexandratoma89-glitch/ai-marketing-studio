'use client';
import {useEffect,useRef,useState,useId} from 'react';
import Link from 'next/link';
import BotCheck from './bot-check';
import {WELCOME_POLICY} from '@/lib/welcome/policy';
import './welcome-offer.css';
export type WelcomeProps={available:boolean;demo:boolean;siteKey:string};
export function WelcomeForm({available,demo,siteKey}:WelcomeProps){
 const [bot,setBot]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 const id=useId();
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage('');const form=new FormData(event.currentTarget);try{
 const response=await fetch('/api/welcome',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),website:form.get('website'),requested:form.get('requested')==='on',botToken:bot,policyVersion:WELCOME_POLICY})});
 const data=await response.json();if(!response.ok)throw new Error(data.error);setDone(true);setMessage(data.simulated?'Test reușit. Emailul a fost simulat; nu s-a trimis niciun mesaj real.':'Cererea ta a fost înregistrată. Verifică emailul și folderul Spam. Dacă ai cerut deja oferta, folosește mesajul primit.');
 try{localStorage.setItem('divine-welcome-until',String(Date.now()+90*86400000));}catch{}
 }catch(error){setMessage(error instanceof Error?error.message:'Nu am putut înregistra solicitarea. Încearcă mai târziu.');}finally{setBusy(false);}}
 return <>{done?<div role="status" className="welcome-success"><span aria-hidden="true">✧</span><p>{message}</p><Link href="/tarot-gratuit/rezervare">Descoperă lectura privată →</Link></div>:<form onSubmit={submit}>
 {!available&&<p className="welcome-note" role="status">Oferta prin email va fi disponibilă în curând. Poți explora între timp lectura privată.</p>}
 <label htmlFor={`${id}-email`}>Adresa ta de email</label><input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="tu@exemplu.ro" maxLength={254} required disabled={!available||busy}/>
 <div className="tarot-honeypot" aria-hidden="true"><input name="website" aria-label="Website" tabIndex={-1} autoComplete="off"/></div>
 <label className="welcome-consent"><input name="requested" type="checkbox" required disabled={!available||busy}/><span>Doresc să primesc prin email oferta de bun venit de 10%. Am citit <Link href="/tarot-gratuit/confidentialitate" target="_blank" rel="noopener noreferrer">informarea de confidențialitate</Link>.</span></label>
 <p className="welcome-note">Un singur email cu oferta solicitată. Fără înscriere automată la newsletter.</p>
 {available&&<BotCheck demo={demo} siteKey={siteKey} onToken={setBot}/>}
 {message&&<p role="alert" className="tarot-error">{message}</p>}
 <button className="tarot-primary" disabled={!available||!bot||busy}>{busy?'Înregistrăm solicitarea…':'Trimite-mi oferta de 10%'}</button>
 </form>}</>;
}
export function WelcomeContent(props:WelcomeProps){return <><p className="welcome-eyebrow">✧ UN BUN VENIT, PENTRU TINE</p><h2 id="welcome-title">Un moment al tău.<br/><em>Cu 10% mai aproape.</em></h2><p className="welcome-intro">Lasă-ne emailul și primește oferta pentru prima ta lectură privată eligibilă.</p><p className="welcome-price"><s>179 lei</s> <strong>161,10 lei</strong> <span>/ 30 de minute</span></p><WelcomeForm {...props}/><p className="welcome-terms">Pentru prima rezervare eligibilă, cu aceeași adresă de email. Reducerea se aplică automat; fără cod. Nu se cumulează și nu se aplică abonamentului. Disponibilitatea și modul de rezervare sunt afișate pe pagina serviciului.</p></>;}
export default function WelcomeOffer(props:WelcomeProps){const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);const [open,setOpen]=useState(false);
 function show(){setOpen(true);}
 function close(){dialog.current?.close();setOpen(false);try{localStorage.setItem('divine-welcome-until',String(Math.max(Number(localStorage.getItem('divine-welcome-until'))||0,Date.now()+7*86400000)));}catch{}trigger.current?.focus();}
 useEffect(()=>{if(!props.available)return;const timer=setTimeout(()=>{let until=0;try{until=Number(localStorage.getItem('divine-welcome-until'));}catch{}if(until>Date.now()||document.hidden||document.querySelector('dialog[open]')||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName??''))return;setOpen(true);},12000);return()=>clearTimeout(timer);},[props.available]);
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 return <><button ref={trigger} className="welcome-trigger" onClick={show} aria-haspopup="dialog">✧ Oferta de bun venit · −10%</button>{open&&<dialog ref={dialog} className="welcome-dialog" aria-labelledby="welcome-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===dialog.current)close();}}><div className="welcome-content"><button autoFocus className="welcome-close" aria-label="Închide oferta" onClick={close}>×</button><WelcomeContent {...props}/><button className="welcome-dismiss" onClick={close}>Poate mai târziu</button></div></dialog>}</>;
}
