'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowLeft, Compass, ChevronRight, Clock } from 'lucide-react';
import { getWishlistItems, type WishlistItem } from '@/lib/utils';

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} semaine${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  return `il y a ${Math.floor(diffDays / 30)} mois`;
}

export default function EnviesPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(getWishlistItems());
  }, []);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
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
          <h1 className="text-lg font-bold text-primary">Mes souhaits</h1>
        </div>
        {items.length > 0 && (
          <span className="ml-auto text-sm text-gray-400">{items.length} séjour{items.length > 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {items.length === 0 ? (
          /* État vide */
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-10 h-10 text-red-300" />
            </div>
            <h2 className="text-lg font-semibold text-primary mb-2">Pas encore de souhaits</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Quand un séjour te plaît, clique sur &quot;Ajouter à mes souhaits&quot; pour l'enregistrer ici.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-full font-medium hover:bg-secondary/90 transition"
            >
              <Compass className="w-4 h-4" />
              Explorer les séjours
            </Link>
          </div>
        ) : (
          /* Liste des souhaits */
          <div className="space-y-3">
            {items.map((item) => {
              const stayLabel = item.stayId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
                        {item.prenom && (
                          <span className="text-xs text-secondary font-medium bg-secondary/10 px-2 py-0.5 rounded-full">
                            {item.prenom}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {timeAgo(item.addedAt)}
                        </span>
                        {item.emailStructure && (
                          <span className="text-xs text-gray-500 truncate max-w-[140px]">
                            Éducateur : {item.emailStructure}
                          </span>
                        )}
                      </div>
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
                Trouver d'autres séjours
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
