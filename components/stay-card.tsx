'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, Users, Clock, Heart } from 'lucide-react';
import type { Stay } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { useApp } from './providers';

export function StayCard({ stay }: { stay: Stay }) {
  const { mode, mounted, isInWishlist, toggleWishlist } = useApp();
  const isKids = mode === 'kids';
  const slug = stay?.slug ?? '';
  const isLiked = mounted && isInWishlist(slug);

  const themes = Array.isArray(stay?.themes) ? stay.themes : [];
  const nextSession = stay?.nextSessionStart;

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (slug) toggleWishlist(slug);
  };

  return (
    <Link href={`/sejour/${slug}`}>
      <article className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden group">
        <div className="relative aspect-[16/10] bg-primary-100">
          <Image
            src={stay?.imageCover ?? '/og-image.png'}
            alt={stay?.title ?? 'Séjour'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              stay?.period === 'printemps' 
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {stay?.period === 'printemps' ? 'Printemps' : 'Été'}
            </span>
          </div>
          {/* Heart button */}
          <button
            onClick={handleHeartClick}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isLiked 
                ? 'bg-red-500 text-white' 
                : 'bg-white/80 text-primary-400 hover:bg-white hover:text-red-500'
            }`}
            aria-label={isLiked ? 'Retirer des envies' : 'Ajouter aux envies'}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-primary text-lg mb-2 group-hover:text-accent transition-colors">
            {stay?.title ?? 'Sans titre'}
          </h3>

          <p className="text-sm text-primary-600 mb-3 line-clamp-2">
            {stay?.descriptionShort ?? ''}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {themes.slice(0, 3).map((theme) => (
              <span
                key={theme}
                className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs rounded"
              >
                {theme}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-primary-500 mb-3">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{stay?.ageMin ?? 0}-{stay?.ageMax ?? 0} ans</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{stay?.durationDays ?? 0} jours</span>
            </div>
            <div className="flex items-center gap-1 col-span-2">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">{stay?.geography ?? ''}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-primary-100">
            {nextSession && (
              <div className="flex items-center gap-1 text-xs text-primary-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(nextSession)}</span>
              </div>
            )}
            {/* Prix masqué : API publique ne retourne pas priceFrom (sécurité) */}
            <span className="text-accent text-sm font-medium">
              {isKids ? 'Découvrir →' : 'Voir le séjour →'}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
