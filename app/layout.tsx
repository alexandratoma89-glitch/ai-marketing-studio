import type { Metadata } from 'next';
import './globals.css';
import {headers} from 'next/headers';
export const metadata: Metadata = { title: 'The Divine Work — Ghidare prin tarot', description: 'Un spațiu pentru reflecție, intuiție și ghidare prin tarot.' };
export default async function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { const locale=(await headers()).get('x-divine-locale')==='en'?'en':'ro';return <html lang={locale}><body>{children}</body></html>; }
