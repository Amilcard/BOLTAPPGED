'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '@/components/providers';
import { StayCard } from '@/components/stay-card';
import { SearchFilterBar } from '@/components/search-filter-bar';
import { FilterSheet, type Filters, DEFAULT_FILTERS } from '@/components/filter-sheet';
import { ActiveFilterChips } from '@/components/active-filter-chips';
import type { Stay } from '@/lib/types';

// Helper to check age range overlap
function ageMatchesFilter(ageMin: number, ageMax: number, filterAges: string[]): boolean {
  if (filterAges.length === 0) return true;
  return filterAges.some((range) => {
    if (range === '3-5') return ageMin <= 5 && ageMax >= 3;
    if (range === '6-10') return ageMin <= 10 && ageMax >= 6;
    if (range === '11-17') return ageMin <= 17 && ageMax >= 11;
    return true;
  });
}

// Helper to check duration range
function durationMatchesFilter(days: number, filterDuree: string[]): boolean {
  if (filterDuree.length === 0) return true;
  return filterDuree.some((range) => {
    if (range === '1-7') return days >= 1 && days <= 7;
    if (range === '8-14') return days >= 8 && days <= 14;
    if (range === '15+') return days >= 15;
    return true;
  });
}

// Horizontal carousel component
function StayCarousel({ title, stays }: { title: string; stays: Stay[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  if (stays.length === 0) return null;

  return (
    <section className="py-4">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-primary">{title}</h2>
          <div className="hidden md:flex gap-1">
            <button onClick={() => scroll('left')} className="p-1.5 rounded-full bg-primary-50 hover:bg-primary-100 transition">
              <ChevronLeft className="w-4 h-4 text-primary" />
            </button>
            <button onClick={() => scroll('right')} className="p-1.5 rounded-full bg-primary-50 hover:bg-primary-100 transition">
              <ChevronRight className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
        >
          {stays.map((stay) => (
            <div key={stay.id} className="flex-shrink-0 w-[260px] snap-start">
              <StayCard stay={stay} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeContent({ stays }: { stays: Stay[] }) {
  const { mode, mounted } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Extract unique themes from all stays
  const availableThemes = useMemo(() => {
    const themes = new Set<string>();
    stays.forEach((stay) => {
      if (Array.isArray(stay?.themes)) {
        stay.themes.forEach((t) => themes.add(t));
      }
    });
    return Array.from(themes).sort();
  }, [stays]);

  // Apply all filters
  const filteredStays = useMemo(() => {
    return stays.filter((stay) => {
      if (!stay) return false;

      // Search query (title, description, themes, geography)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchFields = [
          stay.title,
          stay.descriptionShort,
          stay.geography,
          ...(Array.isArray(stay.themes) ? stay.themes : []),
        ].join(' ').toLowerCase();
        if (!searchFields.includes(q)) return false;
      }

      // Period filter
      if (filters.periode !== 'toutes' && stay.period !== filters.periode) {
        return false;
      }

      // Age filter
      if (!ageMatchesFilter(stay.ageMin ?? 0, stay.ageMax ?? 99, filters.ages)) {
        return false;
      }

      // Duration filter
      if (!durationMatchesFilter(stay.durationDays ?? 0, filters.duree)) {
        return false;
      }

      // Location filter
      if (filters.lieu.trim()) {
        const lieu = filters.lieu.toLowerCase();
        if (!stay.geography?.toLowerCase().includes(lieu)) {
          return false;
        }
      }

      // Themes filter
      if (filters.thematiques.length > 0) {
        const stayThemes = Array.isArray(stay.themes) ? stay.themes : [];
        if (!filters.thematiques.some((t) => stayThemes.includes(t))) {
          return false;
        }
      }

      return true;
    });
  }, [stays, searchQuery, filters]);

  // Count active filters (excluding search)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.ages.length > 0) count++;
    if (filters.periode !== 'toutes') count++;
    if (filters.duree.length > 0) count++;
    if (filters.lieu.trim()) count++;
    if (filters.thematiques.length > 0) count++;
    return count;
  }, [filters]);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
  }, []);

  const isKids = mounted && mode === 'kids';

  // Carousel data: Séjours demandés (first 6)
  const sejoursDemandes = useMemo(() => stays.slice(0, 6), [stays]);

  // Carousel data: Plein Air (nature, aventure, sport themes)
  const sejoursPleinAir = useMemo(() => {
    const pleinAirKeywords = ['nature', 'aventure', 'sport', 'montagne', 'mer', 'nautique'];
    const filtered = stays.filter((s) => {
      const themes = Array.isArray(s.themes) ? s.themes.map(t => t.toLowerCase()) : [];
      const title = s.title?.toLowerCase() || '';
      return pleinAirKeywords.some(k => themes.some(t => t.includes(k)) || title.includes(k));
    });
    return filtered.length > 0 ? filtered.slice(0, 6) : stays.slice(0, 4);
  }, [stays]);

  // Carousel data: Bonnes idées (culture, patrimoine, or fallback)
  const sejoursBonnesIdees = useMemo(() => {
    const cultureKeywords = ['culture', 'patrimoine', 'art', 'histoire', 'découverte'];
    const filtered = stays.filter((s) => {
      const themes = Array.isArray(s.themes) ? s.themes.map(t => t.toLowerCase()) : [];
      const title = s.title?.toLowerCase() || '';
      return cultureKeywords.some(k => themes.some(t => t.includes(k)) || title.includes(k));
    });
    return filtered.length > 0 ? filtered.slice(0, 6) : stays.slice(2, 6);
  }, [stays]);

  // Check if any filters are active (to show carousels or filtered grid)
  const hasActiveFilters = searchQuery.trim() !== '' || activeFiltersCount > 0;

  return (
    <main className="bg-background min-h-screen flex flex-col">
      {/* Compact hero - desktop only */}
      <section className="hidden md:block relative h-[20vh] min-h-[140px]">
        <Image
          src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80"
          alt="Paysage montagne"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-primary/60" />
        <div className="relative z-10 h-full flex items-center justify-center text-white px-4">
          <h1 className="text-2xl font-bold">
            {isKids ? 'Des vacances inoubliables !' : 'Trouvez le séjour idéal'}
          </h1>
        </div>
      </section>

      {/* Mobile header - minimal */}
      <div className="md:hidden bg-primary text-white px-4 py-3 text-center">
        <h1 className="text-base font-semibold">
          {isKids ? 'Trouve ton séjour !' : 'Catalogue des séjours'}
        </h1>
      </div>

      {/* Sticky Search & Filter Bar */}
      <div id="sejours" className="scroll-mt-16">
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenFilters={() => setIsFilterOpen(true)}
          activeFiltersCount={activeFiltersCount}
        />
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChips
        filters={filters}
        onFiltersChange={setFilters}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Content: Carousels OR Filtered Grid */}
      {!hasActiveFilters ? (
        <div className="py-4 space-y-2">
          <StayCarousel 
            title={isKids ? '🔥 Les plus demandés' : 'Séjours les plus demandés'} 
            stays={sejoursDemandes} 
          />
          <StayCarousel 
            title={isKids ? '🌲 Aventures plein air' : 'Séjours Plein Air'} 
            stays={sejoursPleinAir} 
          />
          <StayCarousel 
            title={isKids ? '💡 Bonnes idées' : 'Séjours bonnes idées'} 
            stays={sejoursBonnesIdees} 
          />
        </div>
      ) : (
        /* Filtered results grid */
        <section className="py-6">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary">Résultats</h2>
              <span className="text-sm text-primary-400">
                {filteredStays.length} séjour{filteredStays.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredStays.length === 0 ? (
              <div className="text-center py-12 bg-primary-50/50 rounded-xl">
                <p className="text-primary-500 mb-4">Aucun séjour ne correspond à vos critères</p>
                <button
                  onClick={handleResetFilters}
                  className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition"
                >
                  Réinitialiser
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStays.map(stay => (
                  <StayCard key={stay?.id} stay={stay} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Filter Bottom Sheet */}
      <FilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        availableThemes={availableThemes}
        resultCount={hasActiveFilters ? filteredStays.length : stays.length}
      />

      {/* Spacer to push footer down */}
      <div className="flex-1" />

      {/* Footer */}
      <footer className="bg-primary text-white py-6 mt-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-primary-200 text-sm">
            © 2026 Groupe & Découverte. Tous droits réservés.
          </p>
        </div>
      </footer>
    </main>
  );
}
