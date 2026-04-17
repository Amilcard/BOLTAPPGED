'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, CalendarDays, MapPin } from 'lucide-react';

function extractTokenPayload(token: string): Record<string, string> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    return JSON.parse(atob(parts[1])) as Record<string, string>;
  } catch {
    return {};
  }
}

function InscriptionUrgenceForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const payload = token ? extractTokenPayload(token) : {};
  const sejourSlug    = payload.sejour_slug ?? '';
  const sessionDate   = payload.session_date ?? '';
  const cityDeparture = payload.city_departure ?? '';

  const dateFormatted = sessionDate
    ? new Date(sessionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const [form, setForm] = useState({ jeune_prenom: '', jeune_nom: '', date_naissance: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [dossierRef, setDossierRef] = useState('');

  if (!token || !sejourSlug) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} aria-hidden="true" />
          <h1 className="text-2xl font-bold text-primary mb-2">Lien invalide</h1>
          <p className="text-gray-600">
            Ce lien d&apos;inscription est invalide ou expiré. Contactez l&apos;équipe Groupe &amp; Découverte pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle2 className="mx-auto mb-4 text-green-500" size={48} aria-hidden="true" />
          <h1 className="text-2xl font-bold text-primary mb-2">Demande envoyée</h1>
          <p className="text-gray-600 mb-4">
            La demande d&apos;inscription a bien été transmise à l&apos;équipe Groupe &amp; Découverte.
            Vous serez contacté(e) rapidement pour confirmer la place.
          </p>
          {dossierRef && (
            <p className="text-sm text-gray-500">
              Référence dossier : <strong className="text-primary">{dossierRef}</strong>
            </p>
          )}
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/inscription-urgence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, token }),
      });

      const data: { error?: { message?: string }; dossierRef?: string } = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? 'Une erreur est survenue. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      if (data.dossierRef) setDossierRef(data.dossierRef);
      setSuccess(true);
    } catch {
      setError('Impossible d\'envoyer la demande. Vérifiez votre connexion.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary mb-1">Inscription urgence</h1>
          <p className="text-gray-500 text-sm">
            Renseignez les informations de l&apos;enfant. L&apos;équipe GED confirme la place sous 24h.
          </p>
        </div>

        {/* Séjour pré-sélectionné (lecture seule) */}
        <div className="mb-6 rounded-brand border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary/60 uppercase tracking-wide mb-2">Séjour réservé</p>
          <p className="font-semibold text-primary text-base">{sejourSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            {dateFormatted && (
              <span className="flex items-center gap-1">
                <CalendarDays size={14} aria-hidden="true" />
                {dateFormatted}
              </span>
            )}
            {cityDeparture && (
              <span className="flex items-center gap-1">
                <MapPin size={14} aria-hidden="true" />
                {cityDeparture}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-brand bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <p className="text-xs text-gray-400"><span aria-hidden="true">*</span> champs obligatoires</p>

          <div>
            <label htmlFor="jeune_prenom" className="block text-sm font-medium text-gray-700 mb-1">
              Prénom de l&apos;enfant <span aria-hidden="true">*</span>
            </label>
            <input
              id="jeune_prenom"
              name="jeune_prenom"
              type="text"
              required
              autoComplete="off"
              value={form.jeune_prenom}
              onChange={handleChange}
              className="w-full rounded-brand border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="jeune_nom" className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l&apos;enfant <span aria-hidden="true">*</span>
            </label>
            <input
              id="jeune_nom"
              name="jeune_nom"
              type="text"
              required
              autoComplete="off"
              value={form.jeune_nom}
              onChange={handleChange}
              className="w-full rounded-brand border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="date_naissance" className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance <span aria-hidden="true">*</span>
            </label>
            <input
              id="date_naissance"
              name="date_naissance"
              type="date"
              required
              value={form.date_naissance}
              onChange={handleChange}
              className="w-full rounded-brand border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          <p className="text-xs text-gray-400 mt-1">
            Les données saisies sont collectées dans le cadre du traitement de votre demande d&apos;inscription (RGPD).
            Contact DPO : <a href="mailto:dpo@groupeetdecouverte.fr" className="underline">dpo@groupeetdecouverte.fr</a>
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-brand bg-secondary text-white font-semibold py-3 px-6 text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Envoi en cours…
              </>
            ) : (
              'Envoyer la demande d\'inscription'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function InscriptionUrgencePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-secondary" size={32} aria-hidden="true" />
      </div>
    }>
      <InscriptionUrgenceForm />
    </Suspense>
  );
}
