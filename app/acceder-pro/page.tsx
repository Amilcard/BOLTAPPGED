'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

const STRUCTURE_TYPES = [
  { value: 'ASE', label: 'ASE (Aide Sociale à l\'Enfance)' },
  { value: 'MECS', label: 'MECS (Maison d\'Enfants à Caractère Social)' },
  { value: 'Foyer', label: 'Foyer' },
  { value: 'Association', label: 'Association' },
  { value: 'CCAS', label: 'CCAS (Centre Communal d\'Action Sociale)' },
  { value: 'Autre', label: 'Autre' },
];

function AccederProForm() {
  const searchParams = useSearchParams();
  const sejourSlug = searchParams.get('sejour') || '';

  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    structureName: '',
    structureType: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rgpdConsent, setRgpdConsent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/pro/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sejour_slug: sejourSlug || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message || 'Une erreur est survenue. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Impossible d\'envoyer la demande. Vérifiez votre connexion.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-brand shadow-brand-lg p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Demande reçue !</h1>
            <p className="text-gray-600 mb-6">
              Vous recevrez vos identifiants à{' '}
              <span className="font-medium text-gray-900">{form.email}</span>{' '}
              sous 24h ouvrées.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              En cas d&apos;urgence :{' '}
              <a href="tel:0423161671" className="text-primary hover:underline font-medium">
                04 23 16 16 71
              </a>
            </p>
            {sejourSlug && (
              <Link
                href={`/sejour/${sejourSlug}`}
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
              >
                <ArrowLeft className="w-4 h-4" />
                Revenir au séjour
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Link
          href={sejourSlug ? `/sejour/${sejourSlug}` : '/'}
          className="inline-flex items-center gap-1 text-primary text-sm mb-6 hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4" />
          {sejourSlug ? 'Retour au séjour' : 'Retour au site'}
        </Link>

        <div className="bg-white rounded-brand shadow-brand-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Demandez votre accès professionnel
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Renseignez vos informations — notre équipe crée votre accès sous 24h ouvrées et vous
            envoie vos identifiants par email.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Prénom + Nom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="prenom"
                  value={form.prenom}
                  onChange={handleChange}
                  required
                  autoComplete="given-name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nom"
                  value={form.nom}
                  onChange={handleChange}
                  required
                  autoComplete="family-name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Structure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la structure <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="structureName"
                value={form.structureName}
                onChange={handleChange}
                required
                placeholder="MECS Les Tilleuls, Foyer de l'Espoir, ASE du Rhône…"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Type de structure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de structure <span className="text-red-500">*</span>
              </label>
              <select
                name="structureType"
                value={form.structureType}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              >
                <option value="">Sélectionnez un type…</option>
                {STRUCTURE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email professionnel <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone{' '}
                <span className="text-gray-400 font-normal text-xs">(optionnel)</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                autoComplete="tel"
                placeholder="Pour vous joindre rapidement"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Champ caché séjour */}
            {sejourSlug && (
              <input type="hidden" name="sejour_slug" value={sejourSlug} />
            )}

            <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rgpdConsent}
                onChange={(e) => setRgpdConsent(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
                required
              />
              <span>
                J&apos;accepte que mes données soient traitées conformément à la{' '}
                <Link href="/confidentialite" target="_blank" className="underline text-primary hover:text-primary/80">
                  politique de confidentialité
                </Link>
              </span>
            </label>

            {error && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !rgpdConsent}
              className="w-full py-3 bg-secondary text-white rounded-pill font-medium hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Envoi en cours…' : 'Envoyer ma demande'}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-5 text-center">
            Vos données sont utilisées uniquement pour créer votre accès. Pas de démarche commerciale.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AccederProPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <AccederProForm />
    </Suspense>
  );
}
