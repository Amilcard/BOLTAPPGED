'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Users, Clock, Home, Shield, ArrowRight } from 'lucide-react';
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
      <article className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-brand hover:shadow-brand-lg hover:border-gray-200 transition-all duration-300 overflow-hidden">
        {/* === ZONE 1: IMAGE & BADGES === */}
        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
          <Image
            src={stay?.imageCover ?? '/og-image.png'}
            alt={displayTitle ?? 'Séjour'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          
          {/* Overlay Gradient pour lisibilité badges du bas */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />

          {/* Badge Age (Haut Gauche) */}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 bg-white/95 text-gray-800 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              {stay?.ageMin ?? 0}-{stay?.ageMax ?? 0} ans
            </span>
          </div>

          {/* Badge Durée (Haut Droite) */}
          <div className="absolute top-3 right-3">
            <span className="px-2.5 py-1 bg-white/95 text-gray-800 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {durationLabel}
            </span>
          </div>

          {/* Badge Thème (Bas Gauche - 1 seul) */}
          {mainTheme && (
            <div className="absolute bottom-3 left-3">
              <span className="px-2.5 py-1 bg-primary text-white text-xs font-semibold rounded-lg shadow-sm">
                {mainTheme.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>

        {/* === ZONE 2: CONTENU STRUCTURÉ === */}
        <div className="flex flex-col flex-1 p-4">
          
          {/* Ligne 1: Titre (Tronqué 1 ligne) */}
          <h3 className="text-lg font-bold text-gray-900 leading-tight truncate mb-1.5 group-hover:text-primary transition-colors">
            {displayTitle ?? 'Séjour sans titre'}
          </h3>

          {/* Ligne 2: Promesse (Tronqué 1 ligne) */}
          <p className="text-sm text-gray-500 line-clamp-1 mb-4 h-5">
            {displayDesc}
          </p>

          {/* Ligne 3: Infrastructures (3 Icônes) */}
          <div className="flex items-center gap-4 text-xs text-gray-600 mb-5">
            {/* Lieu */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{stay?.geography?.split(' ')[0] ?? 'Lieu'}</span>
            </div>
            
            {/* Hébergement */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Home className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{stay?.accommodation ?? 'Centre'}</span>
            </div>

            {/* Encadrement */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Shield className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{stay?.supervision ?? '1/8'}</span>
            </div>
          </div>

          {/* Spacer pour pousser le CTA en bas */}
          <div className="flex-1" />

          {/* === ZONE 3: CTA === */}
          <Button 
            className="w-full justify-between group/btn" 
            variant="secondary"
            size="sm"
          >
            <span>Voir le séjour</span>
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </Button>
        </div>
      </article>
    </Link>
  );
}
