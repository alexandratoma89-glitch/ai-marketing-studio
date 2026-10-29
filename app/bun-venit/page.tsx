import Link from 'next/link';
import {WelcomeContent} from '../components/welcome-offer';
import {welcomeAvailable} from '@/lib/welcome/config';
import {isDemo} from '@/lib/tarot/runtime';
import '../tarot-gratuit/tarot.css';
export const dynamic='force-dynamic';
export const metadata={title:'Oferta de bun venit · 10% · The Divine Work',description:'Primește prin email oferta de 10% pentru prima lectură privată eligibilă.'};
export default function Welcome(){return <main className="tarot-site"><Link href="/" className="tarot-logo welcome-page-logo">✧ The Divine Work</Link><section className="welcome-page"><div className="welcome-content"><WelcomeContent available={welcomeAvailable()} demo={isDemo()} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??''}/><Link className="tarot-return" href="/">Înapoi la site</Link></div></section></main>;}
