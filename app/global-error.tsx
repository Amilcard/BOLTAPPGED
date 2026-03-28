'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="text-5xl mb-6">🌤️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-3">
            Une interruption momentanée
          </h1>
          <p className="text-gray-500 mb-2 leading-relaxed">
            Quelque chose s&apos;est passé de notre côté. Vos informations sont en sécurité.
          </p>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Réessayez dans quelques instants ou contactez-nous si le problème persiste.
          </p>
          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full bg-primary text-white font-medium py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Réessayer
            </button>
            <a
              href="/"
              className="block w-full text-center text-gray-500 hover:text-primary text-sm py-2"
            >
              Retour à l&apos;accueil
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            Besoin d&apos;aide&nbsp;? 04 23 16 16 71 · contact@groupeetdecouverte.fr
          </p>
        </div>
      </body>
    </html>
  );
}
