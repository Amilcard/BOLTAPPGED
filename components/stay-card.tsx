'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Stay } from '@/lib/types';
import { useApp } from '@/components/providers';

export function StayCard({ stay }: { stay: Stay }) {
  const { mode, isAuthenticated } = useApp();
  const isKids = mode === 'kids';
  const _canSeePrices = !isKids && isAuthenticated;

  // === TITRE: CityCrunch marketing_title UNIQUEMENT — plus aucun fallback legacy UFOVAL ===
  const displayTitle = stay?.marketingTitle || 'Séjour';

  // === DESCRIPTION: CityCrunch punchline UNIQUEMENT — plus aucun fallback legacy UFOVAL ===
  const displayDesc = stay?.punchline || '';

  // === LOCALISATION: Premium spot_label > Legacy geography ===
  const spotDisplay = stay?.spotLabel || stay?.geography || 'France';

  // === STANDING: Premium standing_label > Legacy accommodationLabel ===

  // Durée: utiliser durationDays (serveur, Math.ceil) comme source de vérité
  // Recalcul client uniquement si sessions avec durées multiples
  const sessions = stay?.sessions || [];
  const uniqueDurations = sessions.length > 0
    ? Array.from(new Set(
        sessions.map(s => {
          const start = new Date(s.startDate);
          const end = new Date(s.endDate);
          return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }).filter(d => d > 0)
      )).sort((a, b) => a - b)
    : [];

  const durationLabel = uniqueDurations.length > 1
    ? `${uniqueDurations[0]} à ${uniqueDurations[uniqueDurations.length - 1]} jours`
    : `${stay?.durationDays || uniqueDurations[0] || 0} jours`;

  return (
    <Link href={`/sejour/${stay?.id ?? ''}`} className="block h-full group">
      <article className="h-full flex flex-col bg-white rounded-brand border border-gray-200 shadow-sm hover:shadow-card-hover hover:-translate-y-2 transition-all duration-300 overflow-hidden">
        {/* === ZONE 1: IMAGE === */}
        <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
          <Image
            src={stay?.imageCover ?? '/og-image.png'}
            alt={displayTitle ?? 'Séjour'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-40" />
        </div>

        {/* === ZONE 2: CONTENU STRUCTURÉ === */}
        <div className="flex flex-col flex-1 p-5">

          {/* Metadata Row (Structure forcée 2 lignes pour alignement Titre) */}
          <div className="mb-3 text-[10px] font-heading font-bold uppercase tracking-widest text-dark/60 flex flex-col gap-1">
            {/* Ligne 1: Age + Durée */}
            <div className="flex items-center gap-2">
              <span>{(stay?.ageRangesDisplay && !stay.ageRangesDisplay.startsWith('0-0')) ? stay.ageRangesDisplay : (stay?.ageMin && stay?.ageMax ? `${stay.ageMin}-${stay.ageMax} ANS` : 'ENFANTS')}</span>
              <span className="w-0.5 h-2.5 bg-gray-300" />
              <span>{durationLabel.toUpperCase()}</span>
            </div>
            {/* Ligne 2: Lieu */}
            <div className="truncate max-w-full text-gray-500">
              {spotDisplay.toUpperCase()}
            </div>
          </div>

          {/* Ligne 1: Titre (Dark Blue #2E4053) */}
          <h3 className="text-lg font-extrabold text-dark font-heading leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors min-h-[3rem]">
            {displayTitle ?? 'Séjour sans titre'}
          </h3>

          {/* Ligne 2: Punchline */}
          <p className="text-sm text-gray-500 font-sans line-clamp-2 mb-4">
            {displayDesc}
          </p>

          <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
            {/* Prix : visible uniquement en mode pro */}
            {!isKids && stay?.priceFrom ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-gray-500 uppercase tracking-wide">À partir de</span>
                <span className="text-lg font-bold text-secondary font-heading">{stay.priceFrom}€</span>
              </div>
            ) : (
              <div />
            )}

            {/* CTA Minimalist */}
            <span className="px-3 py-1.5 border border-gray-300 rounded-full text-xs font-bold text-dark transition-all duration-300 group-hover:bg-secondary group-hover:text-white group-hover:border-secondary">
              En savoir +
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
