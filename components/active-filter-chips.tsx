'use client';

import { X } from 'lucide-react';
import type { ViewMode } from '@/lib/types';
import { AGE_OPTIONS, PERIODE_OPTIONS, THEMATIQUE_OPTIONS, BUDGET_FALLBACK } from '@/config/filters';
import type { Filters } from './filter-sheet';
import { DEFAULT_FILTERS } from './filter-sheet';

interface ActiveFilterChipsProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  budgetMax?: number;
  mode?: ViewMode;
}

// Build label maps from config
const AGE_LABELS = Object.fromEntries(AGE_OPTIONS.map(opt => [opt.value, opt.label])) as Record<string, string>;
const PERIODE_LABELS = Object.fromEntries(PERIODE_OPTIONS.map(opt => [opt.value, opt.label])) as Record<string, string>;
const THEMATIQUE_LABELS = Object.fromEntries(THEMATIQUE_OPTIONS.map(opt => [opt.value, opt.label])) as Record<string, string>;

export function ActiveFilterChips({
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
  budgetMax,
  mode = 'pro',
}: ActiveFilterChipsProps) {
  const isKids = mode === 'kids';
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  // Search query
  if (searchQuery.trim()) {
    chips.push({
      key: 'search',
      label: `"${searchQuery}"`,
      onRemove: () => onSearchChange(''),
    });
  }

  // Périodes (multi-choice)
  filters.periodes.forEach((periode) => {
    chips.push({
      key: `periode-${periode}`,
      label: PERIODE_LABELS[periode] || periode,
      onRemove: () =>
        onFiltersChange({
          ...filters,
          periodes: filters.periodes.filter((p) => p !== periode),
        }),
    });
  });

  // Ages
  filters.ages.forEach((age) => {
    chips.push({
      key: `age-${age}`,
      label: AGE_LABELS[age] || age,
      onRemove: () =>
        onFiltersChange({
          ...filters,
          ages: filters.ages.filter((a) => a !== age),
        }),
    });
  });

  // Thématiques
  filters.thematiques.forEach((theme) => {
    chips.push({
      key: `theme-${theme}`,
      label: THEMATIQUE_LABELS[theme] || theme,
      onRemove: () =>
        onFiltersChange({
          ...filters,
          thematiques: filters.thematiques.filter((t) => t !== theme),
        }),
    });
  });

  // Budget (hidden in Kids mode)
  const effectiveBudgetMax = budgetMax ?? BUDGET_FALLBACK.MAX;
  if (!isKids && filters.budgetMax !== undefined && filters.budgetMax < effectiveBudgetMax) {
    chips.push({
      key: 'budget',
      label: `Max ${filters.budgetMax}€`,
      onRemove: () => onFiltersChange({ ...filters, budgetMax: undefined }),
    });
  }

  if (chips.length === 0) return null;

  // LOT GRAPHISME 1: Limit display to max 4 chips
  const displayedChips = chips.slice(0, 4);
  const remainingCount = chips.length - displayedChips.length;

  const handleResetAll = () => {
    onFiltersChange(DEFAULT_FILTERS);
    onSearchChange('');
  };

  return (
    // LOT GRAPHISME 1: More subtle background, cleaner chips
    <div className="bg-gray-50/80 border-b border-gray-100 py-2.5 px-4">
      <div className="max-w-6xl mx-auto flex items-center gap-2 flex-wrap">
        {displayedChips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 shadow-brand"
          >
            {chip.label}
            <button
              onClick={chip.onRemove}
              className="p-0.5 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="text-xs text-gray-500 font-medium px-2 py-1.5">
            +{remainingCount} {remainingCount === 1 ? 'filtre' : 'filtres'}
          </span>
        )}
        {chips.length > 1 && (
          <button
            onClick={handleResetAll}
            className="text-xs text-gray-500 hover:text-gray-700 underline ml-1 transition-colors"
          >
            Tout effacer
          </button>
        )}
      </div>
    </div>
  );
}
