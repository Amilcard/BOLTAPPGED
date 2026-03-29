'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, ArrowLeft, Loader2 } from 'lucide-react';

export default function StructureLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeNorm = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(codeNorm)) {
      setError('Le code doit contenir exactement 6 caractères alphanumériques.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/structure/${codeNorm}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Code structure invalide ou introuvable.');
      }
      router.push(`/structure/${codeNorm}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-primary-500 text-sm mb-6 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Retour au site
        </Link>

        <div className="bg-white rounded-xl shadow-card p-8">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Building2 className="w-8 h-8" />
            <span className="text-xl font-bold">Espace Structure</span>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Accédez au récapitulatif des inscriptions de votre structure.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-600 mb-1">
                Code structure
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Ex : AB12CD"
                maxLength={6}
                required
                autoComplete="off"
                className="w-full px-4 py-3 border border-primary-200 rounded-lg font-mono text-lg tracking-widest text-center uppercase focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Ce code vous a été envoyé par email lors de votre première inscription.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Vérification…' : 'Accéder à mon espace'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400 space-y-1">
          <p>Code perdu ? Contactez-nous</p>
          <p>
            <a href="tel:0423161671" className="hover:text-primary">04 23 16 16 71</a>
            {' · '}
            <a href="mailto:contact@groupeetdecouverte.fr" className="hover:text-primary">
              contact@groupeetdecouverte.fr
            </a>
          </p>
          <p className="text-gray-300">lun.–ven. 9h–17h</p>
        </div>
      </div>
    </div>
  );
}
