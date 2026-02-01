'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold text-primary mb-4">Une erreur est survenue</h1>
        <p className="text-primary-400 mb-6">{error.message || 'Quelque chose s\'est mal passé'}</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
