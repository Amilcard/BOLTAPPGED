'use client';

export default function EducateurSouhaitError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center max-w-md px-6">
        <h2 className="text-xl font-semibold text-primary mb-3">Une erreur est survenue</h2>
        <p className="text-sm text-gray-600 mb-6">
          Impossible de charger le souhait. Veuillez réessayer.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-secondary text-white rounded-pill hover:bg-secondary/90 transition-colors"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
