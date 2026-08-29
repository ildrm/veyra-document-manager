import type { Metadata, Viewport } from 'next';
import { Geist, Source_Serif_4 } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { Providers } from './providers';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Veyra', template: '%s · Veyra' },
  description: 'Evidence-first enterprise knowledge and document intelligence.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1119' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
