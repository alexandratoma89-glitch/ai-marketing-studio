import {publicTaxStatus} from '@/lib/commerce/pricing';
import Link from 'next/link';
import CommerceSignup from '@/app/components/commerce-signup';
import {isDemo} from '@/lib/tarot/runtime';
import '../tarot.css';
export const dynamic='force-dynamic';
export default function Subscription(){return <div className="tarot-site"><main className="tarot-document"><Link className="tarot-logo" href="/tarot-gratuit">✧ The Divine Work</Link><h1>Un ritual <em>zilnic.</em></h1><h2>Primele 30 de zile gratuite (0 lei), apoi 29 lei/lună</h2><p>Abonamentul pentru cartea zilnică este opțional și separat de lectura gratuită. Nu începe prin solicitarea unei cărți. Înainte de înscriere vei putea verifica plata recurentă, condițiile și modalitatea de anulare.</p><CommerceSignup taxStatus={publicTaxStatus()} kind="membership" demo={isDemo()} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??''} enabled={process.env.COMMERCE_MODE==='test'}/><Link className="tarot-return" href="/tarot-gratuit">Înapoi la lectura gratuită</Link></main></div>}
