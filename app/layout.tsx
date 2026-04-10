import type { Metadata } from 'next';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr'),
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
      <body className="font-sans">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black">Aller au contenu principal</a>
        <Providers><div id="main-content">{children}</div></Providers>
      </body>
    </html>
  );
}
