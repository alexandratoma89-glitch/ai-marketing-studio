import Link from 'next/link';
import {bookingLink} from '@/lib/launch/config';
import '../tarot.css';
export const dynamic='force-dynamic';
export default function Booking(){const url=bookingLink();return <div className="tarot-site"><main className="tarot-document"><Link className="tarot-logo" href="/tarot-gratuit">✧ The Divine Work</Link><h1>Lectură <em>privată.</em></h1><h2>30 de minute · 49 USD · o singură ședință</h2><p>Un spațiu de conversație și reflecție, cu atenție pentru întrebările tale. Rezervarea este separată de lectura gratuită și de orice abonament.</p>{url?<a className="tarot-primary" href={url} rel="noreferrer">Alege data și rezervă · 49 USD</a>:<div className="tarot-info">Calendarul de rezervări nu este încă disponibil. Nu se solicită și nu se încasează nicio plată pe această pagină.</div>}<Link className="tarot-return" href="/tarot-gratuit">Înapoi la lectura gratuită</Link></main></div>}
