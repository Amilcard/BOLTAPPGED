'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Heart, Check, MessageCircle, X, Clock, ExternalLink, LockKeyhole } from 'lucide-react';

interface Souhait {
  id: string;
  kid_prenom: string;
  sejour_slug: string;
  sejour_titre: string;
  motivation: string;
  status: string;
  reponse_educateur: string | null;
  reponse_date: string | null;
  educateur_prenom: string | null;
  created_at: string;
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  emis:          { label: 'En attente de réponse', color: 'text-orange-700', bg: 'bg-orange-50' },
  vu:            { label: 'Consulté', color: 'text-accent', bg: 'bg-muted' },
  en_discussion: { label: 'En discussion', color: 'text-secondary', bg: 'bg-secondary-50' },
  valide:        { label: 'Validé', color: 'text-primary', bg: 'bg-primary-50' },
  refuse:        { label: 'Non retenu', color: 'text-red-700', bg: 'bg-red-50' },
};

export default function EducateurSouhaitPage() {
  const params = useParams();
  const token = params?.token as string;

  const [souhait, setSouhait] = useState<Souhait | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reponse, setReponse] = useState('');
  const [saved, setSaved] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/educateur/souhait/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setSouhait(data);
        setReponse(data.reponse_educateur || '');
      })
      .catch(() => setError('Impossible de charger ce souhait.'))
      .finally(() => setLoading(false));
  }, [token]);

  const respond = async (statut: string) => {
    if (!souhait || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/educateur/souhait/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statut, reponseEducateur: reponse.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSouhait(s => s ? { ...s, status: data.status, reponse_educateur: reponse.trim() || null } : null);
        setSaved(true);
        if (data.redirect_url) setRedirectUrl(data.redirect_url);
      } else {
        setError(data?.error || 'Erreur lors de l\'enregistrement. Réessayez.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-gray-400 text-sm">Chargement...</div>
    </div>
  );

  if (error || !souhait) return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4"><LockKeyhole className="w-7 h-7 text-primary" /></div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Lien invalide ou expiré</h1>
        <p className="text-gray-600 mb-6">{error || 'Ce lien de souhait n\'est pas valide ou a expiré.'}</p>
        <div className="bg-muted rounded-xl p-4 text-left text-sm text-gray-600 mb-4">
          <p className="font-medium text-gray-700 mb-1">Besoin d&apos;aide ?</p>
          <p>Contactez Groupe &amp; Découverte pour recevoir un nouveau lien :</p>
          <a href="mailto:contact@groupeetdecouverte.fr" className="text-primary hover:underline font-medium">
            contact@groupeetdecouverte.fr
          </a>
          <p className="mt-1 text-xs text-gray-400">Tél : 04 23 16 16 71</p>
        </div>
        <Link href="/" className="inline-block text-primary hover:underline text-sm">
          Découvrir les séjours
        </Link>
      </div>
    </div>
  );

  const statutInfo = STATUT_CONFIG[souhait.status] || STATUT_CONFIG.vu;
  const canRespond = !['valide', 'refuse'].includes(souhait.status);
  const prenom = souhait.educateur_prenom ? ` ${souhait.educateur_prenom}` : '';

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-primary text-white px-4 py-5">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold">Groupe &amp; Découverte</h1>
          <p className="text-sm text-white/70">Souhait de séjour</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* Carte souhait */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-400 fill-current" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Souhait de</p>
              <h2 className="text-lg font-bold text-primary">{souhait.kid_prenom}</h2>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Séjour souhaité</p>
            <p className="font-semibold text-gray-800">{souhait.sejour_titre || souhait.sejour_slug}</p>
            {souhait.sejour_slug && (
              <Link href={`/sejour/${souhait.sejour_slug}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                <ExternalLink className="w-3 h-3" /> Voir la fiche séjour
              </Link>
            )}
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sa motivation</p>
            <p className="text-gray-700 italic text-sm leading-relaxed">« {souhait.motivation} »</p>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${statutInfo.bg} ${statutInfo.color}`}>
            <Clock className="w-3 h-3" />
            {statutInfo.label}
          </div>
        </div>

        {/* Réponse existante */}
        {souhait.reponse_educateur && !canRespond && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Votre réponse</p>
            <p className="text-gray-700 text-sm italic">« {souhait.reponse_educateur} »</p>
          </div>
        )}

        {/* Zone de réponse */}
        {canRespond && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Votre réponse{prenom}</h3>

            <textarea
              value={reponse}
              onChange={e => setReponse(e.target.value)}
              placeholder="Commentaire optionnel pour l'équipe ou pour votre dossier…"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4"
            />

            {saved && (
              <div className="flex items-center gap-2 text-primary text-sm mb-4 bg-primary-50 px-3 py-2 rounded-lg">
                <Check className="w-4 h-4" /> Réponse enregistrée
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => respond('valide')}
                disabled={saving}
                className="flex flex-col items-center gap-1.5 p-3 bg-primary-50 hover:bg-primary-100 text-primary rounded-xl transition disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                <span className="text-xs font-medium">Valider</span>
              </button>
              <button
                onClick={() => respond('en_discussion')}
                disabled={saving}
                className="flex flex-col items-center gap-1.5 p-3 bg-secondary-50 hover:bg-secondary-100 text-secondary rounded-xl transition disabled:opacity-50"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-xs font-medium">On en parle</span>
              </button>
              <button
                onClick={() => respond('refuse')}
                disabled={saving}
                className="flex flex-col items-center gap-1.5 p-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition disabled:opacity-50"
              >
                <X className="w-5 h-5" />
                <span className="text-xs font-medium">Pas possible</span>
              </button>
            </div>
          </div>
        )}

        {/* CTA inscription pré-remplie */}
        {souhait.status === 'valide' && (
          <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-primary font-semibold mb-2">Souhait validé</p>
            <p className="text-primary text-sm mb-4">Vous pouvez démarrer l&apos;inscription de {souhait.kid_prenom}.</p>
            <a
              href={redirectUrl || `/sejour/${souhait.sejour_slug}/reserver?prenom=${encodeURIComponent(souhait.kid_prenom)}&souhait_id=${souhait.id}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary-600 transition text-sm"
            >
              Démarrer l&apos;inscription →
            </a>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-4">
          Groupe &amp; Découverte — Ce lien vous a été envoyé suite au souhait de {souhait.kid_prenom}.
        </p>
      </main>
    </div>
  );
}
