'use client';
import Script from 'next/script';
import {tr,type Locale} from '@/lib/public/i18n';
import {useEffect,useRef,useState} from 'react';
export default function BotCheck({demo,siteKey,onToken,locale='ro'}:{locale?:Locale;demo:boolean;siteKey:string;onToken:(token:string)=>void}){
 const ref=useRef<HTMLDivElement>(null),widget=useRef<string|null>(null);
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 const configured=!!siteKey.trim();
 useEffect(()=>{
  if(demo){onToken('development-only');return;}
  onToken('');
  if(!configured||!ready||!window.turnstile||!ref.current)return;
  try{
   widget.current=window.turnstile.render(ref.current,{sitekey:siteKey,action:'free_tarot',theme:'dark',callback:(token:string)=>{setError('');onToken(token);},'expired-callback':()=>onToken(''),'error-callback':()=>{onToken('');setError(tr(locale,'The security check failed. Reload this page or try again later.','Verificarea de securitate nu a reușit. Reîncarcă pagina sau încearcă mai târziu.'));}});
  }catch{onToken('');setError(tr(locale,'The security check is unavailable. Please try again later.','Verificarea de securitate nu este disponibilă. Verifică configurarea Turnstile.'));}
  return()=>{const id=widget.current;widget.current=null;if(id!==null)try{window.turnstile?.remove(id);}catch{/* A provider cleanup failure must not unmount the customer page. */}};
 },[demo,configured,ready,siteKey,onToken,locale]);
 if(demo)return <p className="tarot-form-note">{tr(locale,'Local test check · no real emails or payments.','Verificare locală simulată · fără emailuri sau plăți reale.')}</p>;
 if(!configured)return <p role="alert" className="tarot-error">{tr(locale,'The security check is not configured. This form is unavailable for now.','Verificarea de securitate nu este încă configurată. Formularul nu poate fi trimis momentan.')}</p>;
 return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={()=>setReady(true)} onError={()=>{onToken('');setError(tr(locale,'The security check did not load. Reload this page and check whether your browser blocked it.','Verificarea de securitate nu s-a încărcat. Reîncarcă pagina și verifică dacă browserul o blochează.'));}}/><div ref={ref}/>{error&&<p role="alert" className="tarot-error">{error}</p>}</>;
}
