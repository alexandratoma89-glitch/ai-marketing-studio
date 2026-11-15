import Link from 'next/link';
import {href,tr,type Locale} from '@/lib/public/i18n';
export default function PurchasesUnavailable({locale,compact=false}:{locale:Locale;compact?:boolean}){
 return <aside className={compact?'dw-launch-notice':'dw-free-launch-panel'} aria-label={tr(locale,'Purchases unavailable','Achiziții indisponibile')}>
  <div><strong>{tr(locale,'Purchases are not available yet.','Achizițiile nu sunt încă disponibile.')}</strong><p>{tr(locale,'Explore our free tarot cards and learning guides. Request a free reading by email and choose whether to receive updates.','Explorează gratuit cărțile de tarot și ghidurile de învățare. Solicită o lectură gratuită prin email și alege dacă dorești să primești noutăți.')}</p></div>
  <div className="dw-actions"><Link className={compact?'dw-text-link':'dw-button'} href={href(locale,'draw')}>{tr(locale,'Draw a free card','Extrage o carte gratuită')}</Link><Link className={compact?'dw-text-link':'dw-button secondary'} href={href(locale,'newsletter')}>{tr(locale,'Free reading & email updates','Lectură gratuită și noutăți')}</Link></div>
 </aside>;
}
