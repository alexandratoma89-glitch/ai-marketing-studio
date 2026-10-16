import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Arcana — AI Marketing Studio', description: 'Studioul tău de marketing pentru ghidare prin tarot.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="ro"><body>{children}</body></html>; }
