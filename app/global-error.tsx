'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rubik } from 'next/font/google';
import { CloudSun } from 'lucide-react';

const rubik = Rubik({ subsets: ['latin'], display: 'swap' });

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [countdown, setCountdown] = useState(5);
  const [retries, setRetries] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    if (retries >= maxRetries) return;
    if (countdown === 0) { setRetries(r => r + 1); reset(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, reset, retries]);

  return (
    <html lang="fr" className={rubik.className}>
      <body className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-brand shadow-brand-lg text-center">
          <div className="mb-6"><CloudSun className="w-12 h-12 text-secondary mx-auto" /></div>
          <h1 className="text-xl font-bold text-gray-800 mb-3">
            Une interruption momentanée
          </h1>
          <p className="text-gray-500 mb-2 leading-relaxed">
            On revient tout de suite. Vos informations sont en sécurité.
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Nouvelle tentative dans {countdown}…
          </p>
          <div className="space-y-3">
            <button
              onClick={() => { setCountdown(0); }}
              className="w-full bg-secondary text-white font-medium py-3 px-6 rounded-pill hover:bg-secondary/90 transition-colors"
            >
              Réessayer maintenant
            </button>
            <Link
              href="/"
              className="block w-full text-center text-gray-500 hover:text-primary text-sm py-2"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            Besoin d&apos;aide&nbsp;? 04 23 16 16 71 · contact@groupeetdecouverte.fr
          </p>
        </div>
      </body>
    </html>
  );
}
