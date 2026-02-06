import type { Metadata } from 'next';
import { Roboto, Nunito } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: 'Groupe & Découverte - Séjours éducatifs pour enfants',
  description: 'Organisateur de séjours éducatifs et vacances pour enfants et adolescents. Nature, sport, culture et aventure.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'Groupe & Découverte',
    description: 'Séjours éducatifs pour enfants et adolescents',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" />
      </head>
      <body className={`${roboto.variable} ${nunito.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
