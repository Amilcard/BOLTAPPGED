'use client';

import { useMemo, useState, useCallback } from 'react';
import { useApp } from '@/components/providers';
import { StayCard } from '@/components/stay-card';
import { SearchFilterBar } from '@/components/search-filter-bar';
import { FilterSheet, type Filters, DEFAULT_FILTERS } from '@/components/filter-sheet';
import { ActiveFilterChips } from '@/components/active-filter-chips';
import { AGE_OPTIONS, THEMATIQUE_KEYWORDS, calculateBudgetRange, BUDGET_FALLBACK } from '@/config/filters';
import type { Stay } from '@/lib/types';
import { HomeCarousels } from '@/components/home-carousels';

// LOT 1: Helper to check age range overlap with new age groups
function ageMatchesFilter(ageMin: number, ageMax: number, filterAges: string[]): boolean {
  if (filterAges.length === 0) return true;
  return filterAges.some((range) => {
    const option = AGE_OPTIONS.find(opt => opt.value === range);
    if (!option) return true;
    return ageMin <= option.maxAge && ageMax >= option.minAge;
  });
}

// LOT 1: Helper to check thematique match
// Priorité: match direct avec gd_stay_themes, sinon fallback keywords
function thematiqueMatchesFilter(stayThemes: string[], filterThematiques: string[]): boolean {
  if (filterThematiques.length === 0) return true;

  return filterThematiques.some((filter) => {
    // 1. Match direct (thèmes depuis gd_stay_themes: MER, MONTAGNE, SPORT, etc.)
    if (stayThemes.includes(filter)) return true;

    // 2. Fallback: keyword matching pour compatibilité legacy
    const keywords = THEMATIQUE_KEYWORDS[filter];
    if (!keywords) return false;
    const themesLower = stayThemes.map(t => t.toLowerCase());
    return keywords.some(keyword => themesLower.some(t => t.includes(keyword)));
  });
}

// LOT UX P1: Grid section for desktop (replaces carousels on lg+)
function StayGrid({ title, stays, columns = 3 }: { title: string; stays: Stay[]; columns?: 3 | 4 }) {
  if (stays.length === 0) return null;

  return (
    <section className="pb-6">
      <div className="max-w-7xl mx-auto px-4">
        {title && <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>}
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${columns}`}>
          {stays.map((stay) => (
            <StayCard key={stay.id} stay={stay} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeContent({
  stays,
  hideInternalSearch = false,
  viewMode = 'carousels',
}: {
  stays: Stay[];
  hideInternalSearch?: boolean;
  viewMode?: 'carousels' | 'grid';
}) {
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

      // Search query (title, description, themes, geography + champs premium)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchFields = [
          stay.title,
          stay.descriptionShort,
          stay.geography,
          ...(Array.isArray(stay.themes) ? stay.themes : []),
          // P1 FIX: Indexer les champs premium pour la recherche
          stay.marketingTitle,
          stay.punchline,
          stay.emotionTag,
          stay.spotLabel,
        ].filter(Boolean).join(' ').toLowerCase();
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

  // Tranches d'âge de référence (axe principal du catalogue)
  const AGE_GROUPS = [
    { label: '6-8 ans', labelKids: '👶 Pour les 6-8 ans', min: 6, max: 8 },
    { label: '9-11 ans', labelKids: '🧒 Pour les 9-11 ans', min: 9, max: 11 },
    { label: '12-14 ans', labelKids: '🎒 Pour les 12-14 ans', min: 12, max: 14 },
    { label: '15-17 ans', labelKids: '🎓 Pour les 15-17 ans', min: 15, max: 17 },
  ];

  // Grouper séjours par tranche d'âge AVEC DEDUPE GLOBAL
  // Règle: 1 séjour = 1 apparition max (première section compatible gagne)
  const sejoursByAge = useMemo(() => {
    const renderedSlugs = new Set<string>();

    return AGE_GROUPS.map(group => {
      // Filtrer: overlap ET pas encore rendu
      const groupStays = stays.filter(s => {
        const sMin = s.ageMin ?? 0;
        const sMax = s.ageMax ?? 99;
        const hasOverlap = sMin <= group.max && sMax >= group.min;
        const notRendered = !renderedSlugs.has(s.slug || s.id);
        return hasOverlap && notRendered;
      });

      // Marquer comme rendus
      groupStays.forEach(s => renderedSlugs.add(s.slug || s.id));

      return { ...group, stays: groupStays };
    }).filter(g => g.stays.length > 0);
  }, [stays]);

  // Check if any filters are active (to show carousels/grids or filtered grid)
  const hasActiveFilters = searchQuery.trim() !== '' || activeFiltersCount > 0;

  return (
    <main className="bg-gray-50 flex flex-col">
      {!hideInternalSearch && (
        <>
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
          <ActiveFilterChips
            filters={filters}
            onFiltersChange={setFilters}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            budgetMax={budgetRange.max}
            mode={mode}
          />
        </>
      )}

      {/* Content: Carousels ou Grille selon viewMode */}
      {filteredStays.length > 0 ? (
        <div>
          {viewMode === 'carousels' ? (
            <HomeCarousels stays={filteredStays} />
          ) : (
            <StayGrid title="" stays={filteredStays} columns={filteredStays.length < 3 ? 3 : 4} />
          )}
        </div>
      ) : (
        /* Zero Results */
        <section className="py-12">
          {/* ... (Zero result UI) */}
          <div className="max-w-lg mx-auto px-4 text-center">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun séjour trouvé</h3>
              <p className="text-gray-500 mb-6">
                Essayez de modifier vos critères de recherche ou de réinitialiser les filtres.
              </p>
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-xl text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        </section>
      )}

      <FilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={filteredStays.length}
        budgetRange={budgetRange}
        showBudgetFilter={showBudgetFilter}
        mode={mode}
      />

      <footer className="bg-primary text-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-primary-200 text-sm">
            © 2026 Groupe & Découverte. Tous droits réservés.
          </p>
        </div>
      </footer>
    </main>
  );
}
