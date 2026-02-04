'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Stay } from '@/lib/types';
import { StayCard } from './stay-card';

interface HomeCarouselsProps {
  stays: Stay[];
}

export function HomeCarousels({ stays }: HomeCarouselsProps) {
  const [pleinAirScroll, setPleinAirScroll] = useState(0);
  const [merScroll, setMerScroll] = useState(0);

  // Filtrer les séjours par thématique
  // Logique alignée avec home-content.tsx : match direct prioritaire, puis fallback keywords
  
  // Carrousel 1: Bords de mer
  const merStays = stays.filter(s => {
    const themes = s.themes || [];
    // Match direct avec 'MER' (depuis gd_stay_themes)
    if (themes.includes('MER')) return true;
    // Fallback: keywords pour compatibilité
    return themes.some(t => t.toUpperCase().includes('MER')) ||
           s.geography?.toLowerCase().includes('mer') ||
           s.geography?.toLowerCase().includes('côte');
  }).slice(0, 10);

  // Carrousel 2: Plein Air & Découverte
  const pleinAirThemes = ['PLEIN_AIR', 'NATURE', 'MONTAGNE', 'CAMPAGNE', 'MULTI', 'DECOUVERTE', 'SPORT'];
  const pleinAirStays = stays.filter(s => {
    const themes = s.themes || [];
    // Match direct avec les thèmes exacts (depuis gd_stay_themes)
    if (themes.some(t => pleinAirThemes.includes(t))) return true;
    // Fallback: keywords pour compatibilité
    return themes.some(t => pleinAirThemes.some(theme => t.toUpperCase().includes(theme)));
  }).slice(0, 10);

  const scrollCarousel = (direction: 'left' | 'right', setScroll: (val: number) => void, currentScroll: number) => {
    const scrollAmount = 320; // Largeur approximative d'une carte
    const newScroll = direction === 'left' 
      ? Math.max(0, currentScroll - scrollAmount)
      : currentScroll + scrollAmount;
    setScroll(newScroll);
  };

  if (pleinAirStays.length === 0 && merStays.length === 0) {
    return null; // Ne rien afficher si aucun séjour
  }

  return (
    <section className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Carrousel 1: Bords de mer */}
      {merStays.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Bords de mer
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => scrollCarousel('left', setMerScroll, merScroll)}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                aria-label="Précédent"
                disabled={merScroll === 0}
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => scrollCarousel('right', setMerScroll, merScroll)}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                aria-label="Suivant"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          
          <div className="relative overflow-hidden">
            <div 
              className="flex gap-4 transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${merScroll}px)` }}
            >
              {merStays.map(stay => (
                <div key={stay.id} className="flex-shrink-0 w-[300px]">
                  <StayCard stay={stay} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Carrousel 2: Plein Air (Strictement en dessous) */}
      {pleinAirStays.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Plein Air & Découverte
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => scrollCarousel('left', setPleinAirScroll, pleinAirScroll)}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                disabled={pleinAirScroll === 0}
                aria-label="Précédent"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => scrollCarousel('right', setPleinAirScroll, pleinAirScroll)}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                aria-label="Suivant"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          
          <div className="relative overflow-hidden">
            <div 
              className="flex gap-4 transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${pleinAirScroll}px)` }}
            >
              {pleinAirStays.map(stay => (
                <div key={stay.id} className="flex-shrink-0 w-[300px]">
                  <StayCard stay={stay} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
