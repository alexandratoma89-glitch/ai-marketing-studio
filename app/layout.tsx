import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'The Divine Work — Ghidare prin tarot', description: 'Un spațiu pentru reflecție, intuiție și ghidare prin tarot.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="ro"><body>{children}</body></html>; }
