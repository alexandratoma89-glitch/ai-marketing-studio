'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import '../../tarot-gratuit/tarot.css';
import './marketing.css';
type Status={settings?:Record<string,boolean>;eligible?:number;synced?:number;pending?:number;drafts?:{id:string;subject:string;state:string;provider_id?:number}[];error?:string};
export default function Marketing(){
 const [status,setStatus]=useState<Status>({}),[subject,setSubject]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[intent,setIntent]=useState('');
 async function refresh(){try{const response=await fetch('/api/studio/marketing',{cache:'no-store'});setStatus(await response.json());}catch{setMessage('Configurarea nu a putut fi încărcată.');}}
 useEffect(()=>{void refresh();},[]);
 const ready=!!status.settings&&Object.values(status.settings).every(Boolean);
 async function action(action:'sync'|'draft'){
  setBusy(true);setMessage('');const id=intent||crypto.randomUUID();if(action==='draft')setIntent(id);
  try{const response=await fetch('/api/studio/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id,subject,body})});const data=await response.json();setMessage(response.ok?action==='draft'?'Ciornă creată în Brevo. Verifică destinatarii, previzualizarea și testul înainte de a apăsa Send în Brevo.':`Sincronizare: ${data.processed} procesate, ${data.failed??0} erori.${data.busy?' O sincronizare rulează deja.':''}`:data.error);await refresh();}catch{setMessage('Rezultat incert. Verifică în Brevo înainte de a crea altă campanie.');}finally{setBusy(false);}
 }
 return <main className="tarot-site"><div className="tarot-document marketing-studio"><Link href="/studio">← Studio</Link><h1>Marketing <em>prin email</em></h1><p>Doar adresele cu acord de marketing confirmat sunt sincronizate. Lectura gratuită și crearea unui cont nu înscriu automat persoana la promoții.</p>
 <section className="tarot-info">{Object.entries(status.settings??{}).map(([key,ok])=><p key={key}>{ok?'✓':'○'} {key}</p>)}{status.error&&<p role="alert">{status.error}</p>}<p>Eligibili: {status.eligible??'—'} · În lista Brevo: {status.synced??'—'} · Modificări în așteptare: {status.pending??'—'}</p><button disabled={!ready||busy} onClick={()=>void action('sync')}>Sincronizează acum</button><p>Sincronizare automată la fiecare 5 minute. Pentru liste mari, sunt necesare mai multe runde. Lista trebuie să fie dedicată acestui site; nu importa manual alte contacte în ea.</p></section>
 <h2>Pregătește o campanie</h2><p>Creează o ciornă pentru lista de abonați confirmată, în limba în care scrii mesajul. Trimiterea finală se face în Brevo, după verificarea destinatarilor și un email de test.</p>
 <form onSubmit={e=>{e.preventDefault();void action('draft');}}><label>Subiect<input required maxLength={150} value={subject} disabled={!!intent} onChange={e=>setSubject(e.target.value)}/></label><label>Mesaj<textarea required maxLength={12000} rows={12} value={body} disabled={!!intent} onChange={e=>setBody(e.target.value)}/></label><h3>Previzualizare</h3><strong>{subject}</strong><p style={{whiteSpace:'pre-wrap'}}>{body}</p><p>Se adaugă automat datele operatorului, confidențialitatea și linkul de dezabonare.</p><button type="submit" disabled={!ready||busy||!!intent||!!status.pending||!status.eligible}>Creează ciornă în Brevo</button></form>
 {!!intent&&<p>Cerere înregistrată. Verifică mai întâi campaniile din Brevo. Reîncarcă pagina doar pentru o campanie nouă.</p>}
 <p role="status">{message}</p><p><a href="https://app.brevo.com/" target="_blank" rel="noreferrer">Deschide Brevo → Marketing → Campaigns</a></p><h2>Ciorne recente</h2>{status.drafts?.map(d=><p key={d.id}>{d.subject} · {d.state==='draft'?`Ciornă Brevo #${d.provider_id}`:'Verifică rezultatul în Brevo; nu reîncerca automat.'} · referință {d.id}</p>)}</div></main>;
}
