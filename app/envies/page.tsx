'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowLeft, Compass, ChevronRight, Clock, Check, MessageCircle, X } from 'lucide-react';
import { getWishlistItems, type WishlistItem } from '@/lib/utils';

interface SouhaitServeur {
  id: string;
  sejour_slug: string;
  status: string;
  reponse_educateur: string | null;
  kid_prenom_referent: string | null;
}

const STATUT_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  emis:          { label: 'Envoyé', color: 'bg-orange-100 text-orange-700', icon: <Clock className="w-3 h-3" /> },
  vu:            { label: 'Consulté', color: 'bg-accent/10 text-accent', icon: <Clock className="w-3 h-3" /> },
  en_discussion: { label: 'En discussion', color: 'bg-secondary-50 text-secondary', icon: <MessageCircle className="w-3 h-3" /> },
  valide:        { label: 'Validé !', color: 'bg-primary-50 text-primary', icon: <Check className="w-3 h-3" /> },
  refuse:        { label: 'Pas cette fois', color: 'bg-red-100 text-red-700', icon: <X className="w-3 h-3" /> },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  const diffDays = Math.floor(diffMins / (60 * 24));

  if (diffMins < 60) return `il y a ${diffMins} min`;
  if (diffDays === 0) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `aujourd'hui à ${h}h${m}`;
  }
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} semaine${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  return `il y a ${Math.floor(diffDays / 30)} mois`;
}

export default function EnviesPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [souhaits, setSouhaits] = useState<SouhaitServeur[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(getWishlistItems());

    // Charger les statuts depuis le serveur
    const kidToken = localStorage.getItem('gd_kid_session_token');
    if (kidToken) {
      void fetch(`/api/souhaits/kid/${kidToken}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setSouhaits(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, []);

  return (
    <main className="min-h-screen bg-muted pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-5 flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400 fill-current" />
          <h1 className="text-lg font-bold text-primary">Mes colos préférées</h1>
        </div>
        {mounted && items.length > 0 && (
          <span className="ml-auto text-sm text-gray-400">{items.length} séjour{items.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {!mounted ? (
          /* Placeholder SSR / pré-hydratation — garde le body visible et l'h1 indexable */
          <div className="text-center py-16" aria-hidden="true">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-10 h-10 text-red-300" />
            </div>
            <p className="text-sm text-gray-400">Chargement de tes colos préférées…</p>
          </div>
        ) : items.length === 0 ? (
          /* État vide */
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-10 h-10 text-red-300" />
            </div>
            <h2 className="text-lg font-semibold text-primary mb-2">C&apos;est quoi ta colo de rêve ?</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Explore les séjours et appuie sur le cœur quand quelque chose t&apos;attire. Ton éducateur verra tes choix.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-full font-medium hover:bg-secondary/90 transition"
            >
              <Compass className="w-4 h-4" />
              Je cherche ma colo
            </Link>
          </div>
        ) : (
          /* Liste des souhaits */
          <div className="space-y-3">
            {items.map((item) => {
              const stayLabel = item.stayId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const souhait = souhaits.find(s => s.sejour_slug === item.stayId);
              const badge = souhait ? STATUT_BADGE[souhait.status] : null;
              return (
                <Link
                  key={item.stayId}
                  href={`/sejour/${item.stayId}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-secondary/30 transition-all p-4 group"
                >
                  <div className="flex items-start gap-3">
                    {/* Icône */}
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-red-100 transition">
                      <Heart className="w-5 h-5 text-red-400 fill-current" />
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-primary text-sm leading-snug mb-1 truncate">
                        {stayLabel}
                      </h2>

                      {item.motivation && (
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2">
                          « {item.motivation} »
                        </p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {timeAgo(item.addedAt)}
                        </span>
                        {badge && (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                            {badge.icon} {badge.label}
                          </span>
                        )}
                      </div>
                      {souhait?.reponse_educateur && (
                        <p className="text-xs text-gray-500 italic mt-1">
                          <MessageCircle className="w-3 h-3 inline mr-1" />{souhait.reponse_educateur}
                        </p>
                      )}
                    </div>

                    {/* Flèche */}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-secondary transition flex-shrink-0 mt-3" />
                  </div>
                </Link>
              );
            })}

            {/* Footer explore */}
            <div className="pt-4 pb-2 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-50 text-primary rounded-full text-sm font-medium hover:bg-primary-100 transition"
              >
                <Compass className="w-4 h-4" />
                Je cherche d&apos;autres séjours
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
