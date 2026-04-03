'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Heart, Clock, Check, X, MessageCircle, ChevronRight, Loader2 } from 'lucide-react';

interface Souhait {
  id: string;
  kid_prenom: string;
  kid_prenom_referent: string | null;
  sejour_slug: string;
  sejour_titre: string | null;
  motivation: string;
  status: string;
  reponse_educateur: string | null;
  reponse_date: string | null;
  educateur_prenom: string | null;
  educateur_token: string;
  created_at: string;
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  emis:          { label: 'Nouveau',        color: 'text-orange-700', bg: 'bg-orange-100', icon: <Clock className="w-3.5 h-3.5" /> },
  vu:            { label: 'Consulté',       color: 'text-blue-700',   bg: 'bg-blue-100',   icon: <Check className="w-3.5 h-3.5" /> },
  en_discussion: { label: 'En discussion',  color: 'text-purple-700', bg: 'bg-purple-100', icon: <MessageCircle className="w-3.5 h-3.5" /> },
  valide:        { label: 'Validé',         color: 'text-green-700',  bg: 'bg-green-100',  icon: <Check className="w-3.5 h-3.5" /> },
  refuse:        { label: 'Pas cette fois', color: 'text-red-700',    bg: 'bg-red-100',    icon: <X className="w-3.5 h-3.5" /> },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem.`;
  return `il y a ${Math.floor(diffDays / 30)} mois`;
}

export default function EducateurSouhaitsPage() {
  const params = useParams();
  const token = params?.token as string;
  const [email, setEmail] = useState('');
  const [souhaits, setSouhaits] = useState<Souhait[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/educateur/souhaits/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || 'Lien invalide ou expiré.');
        }
        return res.json();
      })
      .then((data) => {
        setEmail(data.email);
        setSouhaits(data.souhaits);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">On récupère les souhaits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Ce lien ne fonctionne plus</h1>
          <p className="text-gray-500 text-sm mb-6">
            Ce lien a expiré. Consultez votre boîte mail pour retrouver un lien actif.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition text-sm"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const pending = souhaits.filter(s => !['valide', 'refuse'].includes(s.status));
  const resolved = souhaits.filter(s => ['valide', 'refuse'].includes(s.status));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-lg font-bold">Groupe &amp; Découverte</h1>
          <p className="text-sm text-white/70 mt-0.5">
            Souhaits reçus — {email}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Compteurs */}
        <div className="flex gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-bold text-primary">{souhaits.length}</p>
            <p className="text-xs text-gray-500">souhait{souhaits.length > 1 ? 's' : ''} reçu{souhaits.length > 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-bold text-orange-600">{pending.length}</p>
            <p className="text-xs text-gray-500">à traiter</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-bold text-green-600">{resolved.length}</p>
            <p className="text-xs text-gray-500">traité{resolved.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        {souhaits.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Aucun souhait pour l&apos;instant</h2>
            <p className="text-sm text-gray-500">
              Les jeunes n&apos;ont pas encore exprimé de souhaits. Partagez l&apos;application avec eux pour démarrer.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* À traiter en premier */}
            {pending.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">En attente de réponse</h2>
                {pending.map((s) => (
                  <SouhaitCard key={s.id} souhait={s} />
                ))}
              </>
            )}

            {/* Déjà traités */}
            {resolved.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-6">Déjà répondus</h2>
                {resolved.map((s) => (
                  <SouhaitCard key={s.id} souhait={s} />
                ))}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-gray-400 space-y-1">
          <p>Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
          <p>04 23 16 16 71 — contact@groupeetdecouverte.fr</p>
        </div>
      </main>
    </div>
  );
}

function SouhaitCard({ souhait }: { souhait: Souhait }) {
  const badge = STATUT_CONFIG[souhait.status] || STATUT_CONFIG.emis;
  const isActionable = !['valide', 'refuse'].includes(souhait.status);
  const stayLabel = souhait.sejour_titre || souhait.sejour_slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* En-tête : kid + statut */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
              <Heart className="w-4.5 h-4.5 text-red-400 fill-current" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{souhait.kid_prenom}</p>
              {souhait.kid_prenom_referent && (
                <p className="text-xs text-gray-400">accompagné par {souhait.kid_prenom_referent}</p>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${badge.bg} ${badge.color}`}>
            {badge.icon} {badge.label}
          </span>
        </div>

        {/* Séjour */}
        <Link
          href={`/sejour/${souhait.sejour_slug}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {stayLabel}
        </Link>

        {/* Motivation */}
        <div className="mt-2 bg-gray-50 border-l-3 border-secondary/60 p-3 rounded-r-lg">
          <p className="text-sm text-gray-600 italic leading-relaxed">
            &laquo; {souhait.motivation} &raquo;
          </p>
        </div>

        {/* Réponse éducateur si existante */}
        {souhait.reponse_educateur && (
          <div className="mt-2 bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-500 font-medium mb-0.5">Votre message pour ce jeune</p>
            <p className="text-sm text-blue-800">{souhait.reponse_educateur}</p>
          </div>
        )}

        {/* Footer : date + action */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {timeAgo(souhait.created_at)}
          </span>

          {isActionable ? (
            <Link
              href={`/educateur/souhait/${souhait.educateur_token}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:text-secondary/80 transition"
            >
              Répondre à ce souhait <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <span className="text-xs text-gray-400">
              {souhait.reponse_date ? `Répondu ${timeAgo(souhait.reponse_date)}` : 'Traité'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
