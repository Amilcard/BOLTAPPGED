'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, Users, Clock, ArrowRight } from 'lucide-react';
import type { Stay } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { useApp } from '@/components/providers';

export function StayCard({ stay }: { stay: Stay }) {
  const { mode } = useApp();
  const isKids = mode === 'kids';

  // CityCrunch: affichage Pro/Kids avec fallback
  const displayTitle = isKids
    ? (stay?.titleKids || stay?.title)
    : (stay?.titlePro || stay?.title);
  const displayDesc = isKids
    ? (stay?.descriptionKids || stay?.descriptionShort)
    : (stay?.descriptionPro || stay?.descriptionShort);

  const themes = Array.isArray(stay?.themes) ? stay.themes : [];
  const nextSession = stay?.nextSessionStart;

  const period = stay?.period === 'printemps' ? 'Printemps' : 'Été';
  // LOT GRAPHISME 1: More subtle period badges
  const periodColors = stay?.period === 'printemps'
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-amber-50 text-amber-700 border border-amber-200';

  return (
    <Link href={`/sejour/${stay?.id ?? ''}`}>
      <article className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300 overflow-hidden group">
        {/* Image container - LOT GRAPHISME 1: Cleaner, larger image focus */}
        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
          <Image
            src={stay?.imageCover ?? '/og-image.png'}
            alt={stay?.title ?? 'Séjour'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* Period badge - LOT GRAPHISME 1: Top-left, cleaner design */}
          <div className="absolute top-3 left-3">
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${periodColors} backdrop-blur-sm bg-opacity-90`}>
              {period}
            </span>
          </div>
          {/* LOT UX P0: No heart/wishlist icon */}
        </div>

        {/* Content - LOT GRAPHISME 1: Better spacing and typography */}
        <div className="p-4 sm:p-5">
          {/* Title - LOT GRAPHISME 1: Better typography + CityCrunch Pro/Kids */}
          <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-2 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {displayTitle ?? 'Sans titre'}
          </h3>

          {/* Description - LOT GRAPHISME 1: More subtle + CityCrunch Pro/Kids */}
          <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
            {displayDesc ?? ''}
          </p>

          {/* Info grid - LOT GRAPHISME 1: Cleaner layout */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex flex-col items-center text-center p-2 bg-gray-50 rounded-lg">
              <Users className="w-4 h-4 text-gray-400 mb-1" />
              <span className="text-xs font-medium text-gray-700">{stay?.ageMin ?? 0}-{stay?.ageMax ?? 0}</span>
              <span className="text-[10px] text-gray-400">ans</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 bg-gray-50 rounded-lg">
              <Clock className="w-4 h-4 text-gray-400 mb-1" />
              <span className="text-xs font-medium text-gray-700">{stay?.durationDays ?? 0}</span>
              <span className="text-[10px] text-gray-400">jours</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 bg-gray-50 rounded-lg">
              <MapPin className="w-4 h-4 text-gray-400 mb-1" />
              <span className="text-xs font-medium text-gray-700 truncate w-full">{stay?.geography?.split(' ')[0] ?? ''}</span>
              <span className="text-[10px] text-gray-400">lieu</span>
            </div>
          </div>

          {/* Themes - LOT GRAPHISME 1: More subtle pills */}
          {themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {themes.slice(0, 3).map((theme) => (
                <span
                  key={theme}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] sm:text-xs rounded-md font-medium"
                >
                  {theme}
                </span>
              ))}
              {themes.length > 3 && (
                <span className="px-2 py-0.5 text-gray-400 text-[10px] sm:text-xs">
                  +{themes.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer - LOT GRAPHISME 1: Subtle date + cleaner CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            {nextSession && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(nextSession)}</span>
              </div>
            )}
            {/* LOT GRAPHISME 1: More subtle CTA with blue accent */}
            <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 group-hover:text-primary group-hover:gap-2 transition-all">
              {stay?.period === 'printemps' ? 'Découvrir' : 'Voir le séjour'}
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
