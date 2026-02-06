'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Stay } from '@/lib/types';
import { StayCard } from './stay-card';

interface HomeCarouselsProps {
  stays: Stay[];
}

// === CONFIGURATION DES UNIVERS (3 carrousels) ===
// Source de vérité: carousel_group (DB) → titre + sous-titre + ordre d'affichage
// Fusionné: ALTITUDE_AVENTURE + OCEAN_FUN → AVENTURE_DECOUVERTE
// Règle: les badges vendent une INTENSITÉ/ÉMOTION, pas une géographie
const UNIVERSE_CONFIG = [
  {
    key: 'ADRENALINE_SENSATIONS',
    title: 'Sensations & Adrénaline', // Title Case instead of Uppercase
    subtitle: 'Pour les 12-17 ans',
    fallbackSlugs: [
      'moto-moto', 'dh-experience-11-13-ans', 'annecy-element',
      'sperienza-in-corsica-1', 'surf-sur-le-bassin', 'destination-soleil',
      'aqua-fun'
    ]
  },
  {
    key: 'AVENTURE_DECOUVERTE',
    title: 'Aventure & Découverte',
    subtitle: 'Pour les 8-14 ans',
    fallbackSlugs: [
      'les-robinson-des-glieres', 'survie-dans-le-beaufortain', 'yamakasi',
      'e-sport-and-sport', 'explore-mountain', 'mountain-and-chill',
      'glieraventures', 'nature-picture',
      'aqua-mix', 'breizh-equit-kids-8-11-ans',
      'destination-bassin-darcachon-1', 'laventure-verticale'
    ]
  },
  {
    key: 'MA_PREMIERE_COLO',
    title: 'Ma Première Colo',
    subtitle: 'Pour les 3-9 ans',
    fallbackSlugs: [
      'les-ptits-puisotins-1', 'croc-marmotte', 'aqua-gliss',
      'natation-et-sensation', 'les-apprentis-montagnards'
    ]
  }
];

export function HomeCarousels({ stays }: HomeCarouselsProps) {
  // Déterminer si les données premium sont disponibles (au moins 1 séjour a carousel_group)
  const hasPremiumData = useMemo(
    () => stays.some(s => !!s.carouselGroup),
    [stays]
  );

  // Construire les sections
  const sections = useMemo(() => {
    return UNIVERSE_CONFIG.map(config => {
      let sectionStays: Stay[];

      if (hasPremiumData) {
        // MODE PREMIUM: router par carousel_group (DB)
        sectionStays = stays.filter(s => s.carouselGroup === config.key);
      } else {
        // MODE FALLBACK: garder le mapping par slugs hardcodés
        sectionStays = config.fallbackSlugs
          .map(slug => stays.find(s => s.slug === slug || s.id === slug))
          .filter((s): s is Stay => !!s);
      }

      return {
        id: config.key.toLowerCase().replace(/_/g, '-'),
        title: config.title,
        subtitle: config.subtitle,
        stays: sectionStays,
      };
    }).filter(section => section.stays.length > 0);
  }, [stays, hasPremiumData]);

  // Gestion du scroll par section
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});

  const scrollCarousel = (sectionId: string, direction: 'left' | 'right', maxScroll: number) => {
    setScrollPositions(prev => {
      const current = prev[sectionId] || 0;
      const scrollAmount = 320; // ~largeur carte + gap

      let newScroll;
      if (direction === 'left') {
        newScroll = Math.max(0, current - scrollAmount);
      } else {
        newScroll = Math.min(maxScroll, current + scrollAmount);
      }
      return { ...prev, [sectionId]: newScroll };
    });
  };

  return (
    <section className="max-w-7xl mx-auto px-4 py-8 space-y-16">
      {sections.map(section => {
        const currentScroll = scrollPositions[section.id] || 0;
        const cardWidth = 300;
        const gap = 16;
        const cardsTotalWidth = (section.stays.length * cardWidth) + ((section.stays.length - 1) * gap);
        const viewportWidth = 1200;
        const maxScroll = Math.max(0, cardsTotalWidth - viewportWidth);

        return (
          <div key={section.id}>
            <div className="flex items-end justify-between mb-8 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-3xl font-bold text-primary font-heading tracking-tight">
                  {section.title}
                </h2>
                <p className="text-gray-400 text-sm mt-1 font-sans">{section.subtitle}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => scrollCarousel(section.id, 'left', maxScroll)}
                  className="p-2 rounded-full border border-gray-200 hover:border-secondary hover:text-secondary transition-colors disabled:opacity-20"
                  aria-label="Précédent"
                  disabled={currentScroll <= 0}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scrollCarousel(section.id, 'right', maxScroll)}
                  className="p-2 rounded-full border border-gray-200 hover:border-secondary hover:text-secondary transition-colors disabled:opacity-20"
                  aria-label="Suivant"
                  disabled={currentScroll >= maxScroll}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden">
              <div
                className="flex gap-4 transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${currentScroll}px)` }}
              >
                {section.stays.map(stay => (
                  <div key={stay.id} className="flex-shrink-0 w-[300px]">
                    <StayCard stay={stay} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
