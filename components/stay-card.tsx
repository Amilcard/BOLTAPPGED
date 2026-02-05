'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Users, Clock, Home, ArrowRight } from 'lucide-react';
import type { Stay } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useApp } from '@/components/providers';

export function StayCard({ stay }: { stay: Stay }) {
  const { mode } = useApp();
  const isKids = mode === 'kids';

  // CityCrunch: affichage Pro/Kids avec fallback
  const displayTitle = isKids
    ? (stay?.titleKids || stay?.title)
    : (stay?.titlePro || stay?.title);
  
  // Description courte (Promesse)
  const displayDesc = isKids
    ? (stay?.descriptionKids || stay?.descriptionShort)
    : (stay?.descriptionPro || stay?.descriptionShort);

  const themes = Array.isArray(stay?.themes) ? stay.themes : [];
  const mainTheme = themes.length > 0 ? themes[0] : null;

  // Lot 10A (Strict): Logique 'Smart' si sessions disponibles
  const sessions = stay?.sessions || [];
  
  // Durée
  const uniqueDurations = Array.from(new Set(
    sessions.map(s => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    })
  )).sort((a, b) => a - b);
  
  const durationLabel = uniqueDurations.length > 1
    ? `${uniqueDurations[0]} à ${uniqueDurations[uniqueDurations.length - 1]} jours`
    : `${stay?.durationDays ?? 0} jours`;

  return (
    <Link href={`/sejour/${stay?.id ?? ''}`} className="block h-full group">
      <article className="h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 overflow-hidden">
        {/* === ZONE 1: IMAGE & BADGES === */}
        {/* Ratio plus panoramique pour réduire la dominance visuelle */}
        <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
          <Image
            src={stay?.imageCover ?? '/og-image.png'}
            alt={displayTitle ?? 'Séjour'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />

          {/* Badge Age (Haut Gauche) - Design pillule discret */}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 bg-white/95 text-gray-800 text-xs font-bold rounded-full shadow-sm flex items-center gap-1.5 backdrop-blur-sm">
              <Users className="w-3.5 h-3.5 text-primary" />
              {stay?.ageRangesDisplay ?? `${stay?.ageMin ?? 0}-${stay?.ageMax ?? 0} ans`}
            </span>
          </div>

          {/* Badge Durée (Haut Droite) */}
          <div className="absolute top-3 right-3">
            <span className="px-2.5 py-1 bg-white/95 text-gray-800 text-xs font-bold rounded-full shadow-sm flex items-center gap-1.5 backdrop-blur-sm">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {durationLabel}
            </span>
          </div>

          {/* Badge Thème (Bas Gauche) */}
          {mainTheme && (
            <div className="absolute bottom-3 left-3">
              <span className="px-2.5 py-1 bg-primary/90 text-white text-xs font-semibold rounded-md shadow-sm backdrop-blur-sm">
                {mainTheme.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>

        {/* === ZONE 2: CONTENU STRUCTURÉ === */}
        <div className="flex flex-col flex-1 p-5">
          
          {/* Ligne 1: Titre */}
          <h3 className="text-lg font-bold text-gray-900 leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {displayTitle ?? 'Séjour sans titre'}
          </h3>

          {/* Ligne 2: Promesse (Discret) */}
          <p className="text-sm text-gray-500 line-clamp-2 mb-4">
            {displayDesc}
          </p>

          <div className="mt-auto pt-4 border-t border-gray-100">
             {/* Infrastructures condensées */}
            <div className="flex items-center justify-between text-xs text-gray-600 mb-4">
              {/* Lieu */}
              <div className="flex items-center gap-1.5 truncate pr-2">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate font-medium">{stay?.geography?.split(' ')[0] ?? 'Lieu'}</span>
              </div>
              
              {/* Hébergement */}
              <div className="flex items-center gap-1.5 truncate pl-2 border-l border-gray-200">
                <Home className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate font-medium">{stay?.accommodation ?? 'Centre'}</span>
              </div>
            </div>

            {/* CTA Full Width mais discret */}
            <div className="w-full py-2 bg-gray-50 text-primary text-sm font-semibold rounded-lg text-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
              Voir le séjour
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
