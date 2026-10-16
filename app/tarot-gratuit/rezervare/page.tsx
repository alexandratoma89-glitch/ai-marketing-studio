import {publicTaxStatus} from '@/lib/commerce/pricing';
import Link from 'next/link';
import CommerceSignup from '@/app/components/commerce-signup';
import {isDemo} from '@/lib/tarot/runtime';
import '../tarot.css';
export const dynamic='force-dynamic';
export default function Booking(){return <div className="tarot-site"><main className="tarot-document"><Link className="tarot-logo" href="/tarot-gratuit">✧ The Divine Work</Link><h1>Lectură <em>privată.</em></h1><h2>30 de minute · 179 lei · o singură ședință</h2><p>Un spațiu de conversație și reflecție, cu atenție pentru întrebările tale. Rezervarea este separată de lectura gratuită și de orice abonament.</p><CommerceSignup taxStatus={publicTaxStatus()} kind="booking" demo={isDemo()} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??''} enabled={process.env.COMMERCE_MODE==='test'}/><Link className="tarot-return" href="/tarot-gratuit">Înapoi la lectura gratuită</Link></main></div>}
