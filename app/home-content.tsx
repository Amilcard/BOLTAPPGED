'use client';

import { useMemo, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { StayCard } from '@/components/stay-card';
import { SearchFilterBar } from '@/components/search-filter-bar';
import { FilterSheet, type Filters, DEFAULT_FILTERS } from '@/components/filter-sheet';
import { ActiveFilterChips } from '@/components/active-filter-chips';
import { AGE_OPTIONS, THEMATIQUE_KEYWORDS, calculateBudgetRange, BUDGET_FALLBACK } from '@/config/filters';
import type { Stay } from '@/lib/types';

// LOT 1: Helper to check age range overlap with new age groups
function ageMatchesFilter(ageMin: number, ageMax: number, filterAges: string[]): boolean {
  if (filterAges.length === 0) return true;
  return filterAges.some((range) => {
    const option = AGE_OPTIONS.find(opt => opt.value === range);
    if (!option) return true;
    return ageMin <= option.maxAge && ageMax >= option.minAge;
  });
}

// LOT 1: Helper to check thematique match (keywords matching from config)
function thematiqueMatchesFilter(stayThemes: string[], filterThematiques: string[]): boolean {
  if (filterThematiques.length === 0) return true;
  const themes = stayThemes.map(t => t.toLowerCase());

  return filterThematiques.some((filter) => {
    const keywords = THEMATIQUE_KEYWORDS[filter];
    if (!keywords) return false;
    return keywords.some(keyword => themes.some(t => t.includes(keyword)));
  });
}

// LOT UX P1: Grid section for desktop (replaces carousels on lg+)
function StayGrid({ title, stays, columns = 3 }: { title: string; stays: Stay[]; columns?: 3 | 4 }) {
  if (stays.length === 0) return null;

  return (
    <section className="pb-6">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${columns}`}>
          {stays.map((stay) => (
            <StayCard key={stay.id} stay={stay} />
          ))}
        </div>
      </div>
    </section>
  );
}

// LOT UX P1: Mobile carousel component (keeps horizontal scroll)
function StayCarousel({ title, stays }: { title: string; stays: Stay[] }) {
  if (stays.length === 0) return null;

  return (
    <section className="pb-4 lg:hidden">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
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

  // Define isKids early (used in multiple hooks)
  const isKids = mounted && mode === 'kids';

  // LOT 1: Calculate budget range from actual stays (Option A)
  const budgetRange = useMemo(() => {
    const prices = stays
      .map(s => (s as any).priceFrom)
      .filter((p): p is number => p != null && p > 0);
    return calculateBudgetRange(prices);
  }, [stays]);

  // LOT 1: Determine if budget filter should be shown (only if prices are visible AND NOT in Kids mode)
  const showBudgetFilter = useMemo(() => {
    return !isKids && budgetRange.max > BUDGET_FALLBACK.MIN;
  }, [budgetRange, isKids]);

  // Apply all filters (LOT 1: updated filter logic)
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

      // Period filter (multi-choice - LOT 1)
      if (filters.periodes.length > 0 && !filters.periodes.includes(stay.period)) {
        return false;
      }

      // Age filter
      if (!ageMatchesFilter(stay.ageMin ?? 0, stay.ageMax ?? 99, filters.ages)) {
        return false;
      }

      // Thématique filter (LOT 1: keyword matching)
      if (!thematiqueMatchesFilter(stay.themes || [], filters.thematiques)) {
        return false;
      }

      // Budget filter (LOT 1: filter by max budget - only for authenticated pros with prices)
      if (showBudgetFilter && filters.budgetMax !== undefined && filters.budgetMax < budgetRange.max) {
        const stayPrice = (stay as any).priceFrom;
        if (stayPrice && stayPrice > filters.budgetMax) {
          return false;
        }
      }

      return true;
    });
  }, [stays, searchQuery, filters, budgetRange, showBudgetFilter]);

  // Count active filters (excluding search) - LOT 1: dynamic budget max
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.ages.length > 0) count++;
    if (filters.periodes.length > 0) count++;
    if (filters.thematiques.length > 0) count++;
    if (showBudgetFilter && filters.budgetMax !== undefined && filters.budgetMax < budgetRange.max) count++;
    return count;
  }, [filters, budgetRange, showBudgetFilter]);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
  }, []);

  // Carousel/Grid data: Séjours demandés (first 6)
  const sejoursDemandes = useMemo(() => stays.slice(0, 6), [stays]);

  // Carousel/Grid data: Plein Air (nature, aventure, sport themes)
  const sejoursPleinAir = useMemo(() => {
    const pleinAirKeywords = ['nature', 'aventure', 'sport', 'montagne', 'mer', 'nautique'];
    const filtered = stays.filter((s) => {
      const themes = Array.isArray(s.themes) ? s.themes.map(t => t.toLowerCase()) : [];
      const title = s.title?.toLowerCase() || '';
      return pleinAirKeywords.some(k => themes.some(t => t.includes(k)) || title.includes(k));
    });
    return filtered.length > 0 ? filtered.slice(0, 6) : stays.slice(0, 4);
  }, [stays]);

  // Carousel/Grid data: Bonnes idées (culture, patrimoine, or fallback)
  const sejoursBonnesIdees = useMemo(() => {
    const cultureKeywords = ['culture', 'patrimoine', 'art', 'histoire', 'découverte'];
    const filtered = stays.filter((s) => {
      const themes = Array.isArray(s.themes) ? s.themes.map(t => t.toLowerCase()) : [];
      const title = s.title?.toLowerCase() || '';
      return cultureKeywords.some(k => themes.some(t => t.includes(k)) || title.includes(k));
    });
    return filtered.length > 0 ? filtered.slice(0, 6) : stays.slice(2, 6);
  }, [stays]);

  // Check if any filters are active (to show carousels/grids or filtered grid)
  const hasActiveFilters = searchQuery.trim() !== '' || activeFiltersCount > 0;

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      {/* Sticky Search & Filter Bar - LOT UX P1: Full width container */}
      <div id="sejours" className="scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenFilters={() => setIsFilterOpen(true)}
            activeFiltersCount={activeFiltersCount}
          />
        </div>
      </div>

      {/* Active Filter Chips - LOT UX P1: Full width container */}
      <ActiveFilterChips
        filters={filters}
        onFiltersChange={setFilters}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        budgetMax={budgetRange.max}
        mode={mode}
      />

      {/* Content: Mobile Carousels + Desktop Grids OR Filtered Grid - LOT UX P0: No gray ribbon */}
      {!hasActiveFilters ? (
        <>
          {/* Desktop: Grid sections (3-4 cols) - LOT UX P1 */}
          <div className="hidden lg:block pb-6 space-y-6">
            <StayGrid title={isKids ? '🔥 Les plus demandés' : 'Séjours les plus demandés'} stays={sejoursDemandes} columns={3} />
            <StayGrid title={isKids ? '🌲 Aventures plein air' : 'Séjours Plein Air'} stays={sejoursPleinAir} columns={3} />
            <StayGrid title={isKids ? '💡 Bonnes idées' : 'Séjours bonnes idées'} stays={sejoursBonnesIdees} columns={3} />
          </div>

          {/* Mobile: Carousels - LOT UX P1 */}
          <div className="lg:hidden">
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
        </>
      ) : (
        /* Filtered results grid - LOT UX P1: Full width container */
        <section className="py-6">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Résultats</h2>
              <span className="text-sm text-gray-500">
                {filteredStays.length} séjour{filteredStays.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredStays.length === 0 ? (
              <div className="text-center py-12 bg-gray-100 rounded-xl">
                <p className="text-gray-500 mb-4">Aucun séjour ne correspond à vos critères</p>
                <button
                  onClick={handleResetFilters}
                  className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition"
                >
                  Réinitialiser
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
        resultCount={hasActiveFilters ? filteredStays.length : stays.length}
        budgetRange={budgetRange}
        showBudgetFilter={showBudgetFilter}
        mode={mode}
      />

      {/* Spacer to push footer down */}
      <div className="flex-1" />

      {/* Footer - LOT UX P1: Full width */}
      <footer className="bg-primary text-white py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-primary-200 text-sm">
            © 2026 Groupe & Découverte. Tous droits réservés.
          </p>
        </div>
      </footer>
    </main>
  );
}
