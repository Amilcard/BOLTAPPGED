'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// Helper : extraire l'email du payload JWT sans vérifier la signature côté client
function extractEmailFromToken(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const payload = JSON.parse(atob(parts[1]));
    return typeof payload.email === 'string' ? payload.email : '';
  } catch {
    return '';
  }
}

function InscriptionUrgenceForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const prefillEmail = token ? extractEmailFromToken(token) : '';

  const [form, setForm] = useState({
    jeune_prenom: '',
    jeune_nom: '',
    date_naissance: '',
    structure_nom: '',
    ville: '',
    referent_email: prefillEmail,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h1 className="text-2xl font-bold text-primary mb-2">Lien invalide</h1>
          <p className="text-gray-600">
            Ce lien d&apos;inscription est invalide ou manquant. Contactez l&apos;équipe Groupe &amp; Découverte pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle2 className="mx-auto mb-4 text-green-500" size={48} />
          <h1 className="text-2xl font-bold text-primary mb-2">Inscription enregistrée</h1>
          <p className="text-gray-600">
            La demande d&apos;inscription a bien été transmise à l&apos;équipe Groupe &amp; Découverte. Vous serez contacté(e) rapidement.
          </p>
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

      const data: { error?: { message?: string } } = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? 'Une erreur est survenue. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Impossible d\'envoyer l\'inscription. Vérifiez votre connexion.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary mb-2">Inscription urgence</h1>
          <p className="text-gray-600 text-sm">
            Remplissez ce formulaire pour inscrire un enfant en urgence. L&apos;équipe Groupe &amp; Découverte prendra en charge votre demande rapidement.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-brand bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Prénom de l'enfant */}
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

          {/* Nom de l'enfant */}
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

          {/* Date de naissance */}
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

          {/* Structure d'accueil */}
          <div>
            <label htmlFor="structure_nom" className="block text-sm font-medium text-gray-700 mb-1">
              Structure d&apos;accueil <span aria-hidden="true">*</span>
            </label>
            <input
              id="structure_nom"
              name="structure_nom"
              type="text"
              required
              autoComplete="organization"
              value={form.structure_nom}
              onChange={handleChange}
              className="w-full rounded-brand border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          {/* Ville */}
          <div>
            <label htmlFor="ville" className="block text-sm font-medium text-gray-700 mb-1">
              Ville <span aria-hidden="true">*</span>
            </label>
            <input
              id="ville"
              name="ville"
              type="text"
              required
              autoComplete="address-level2"
              value={form.ville}
              onChange={handleChange}
              className="w-full rounded-brand border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          {/* Email du référent */}
          <div>
            <label htmlFor="referent_email" className="block text-sm font-medium text-gray-700 mb-1">
              Email du référent <span aria-hidden="true">*</span>
            </label>
            <input
              id="referent_email"
              name="referent_email"
              type="email"
              required
              autoComplete="email"
              value={form.referent_email}
              onChange={handleChange}
              className="w-full rounded-brand border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Pré-rempli depuis votre lien d&apos;invitation. Modifiable si nécessaire.
            </p>
          </div>

          {/* RGPD */}
          <p className="text-xs text-gray-500 mt-2">
            Les données saisies sont collectées dans le cadre du traitement de votre demande d&apos;inscription.
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification et de suppression.
            Contact : <a href="mailto:dpo@groupeetdecouverte.fr" className="underline">dpo@groupeetdecouverte.fr</a>
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
              'Inscrire en urgence'
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
        <Loader2 className="animate-spin text-secondary" size={32} />
      </div>
    }>
      <InscriptionUrgenceForm />
    </Suspense>
  );
}
