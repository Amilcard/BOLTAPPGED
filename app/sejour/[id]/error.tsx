'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50/50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-brand shadow-brand-lg text-center border border-gray-100/50">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Séjour introuvable
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          {error.message || "Nous n'avons pas pu charger ce séjour. Veuillez réessayer."}
        </p>
        <Button onClick={reset} size="lg" className="w-full sm:w-auto">
          Réessayer
        </Button>
      </div>
    </div>
  );
}
