'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown === 0) { reset(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, reset]);

  return (
    <html lang="fr">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-brand shadow-brand-lg text-center">
          <div className="text-5xl mb-6">🌤️</div>
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
