'use client';

import { X } from 'lucide-react';
import type { Filters } from './filter-sheet';
import { DEFAULT_FILTERS } from './filter-sheet';

interface ActiveFilterChipsProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const AGE_LABELS: Record<string, string> = {
  '3-5': '3-5 ans',
  '6-10': '6-10 ans',
  '11-17': '11-17 ans',
};

const DUREE_LABELS: Record<string, string> = {
  '1-7': '1-7 jours',
  '8-14': '8-14 jours',
  '15+': '15+ jours',
};

export function ActiveFilterChips({
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
}: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  // Search query
  if (searchQuery.trim()) {
    chips.push({
      key: 'search',
      label: `"${searchQuery}"`,
      onRemove: () => onSearchChange(''),
    });
  }

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

  // Periode
  if (filters.periode !== 'toutes') {
    chips.push({
      key: 'periode',
      label: filters.periode === 'printemps' ? 'Printemps' : 'Été',
      onRemove: () => onFiltersChange({ ...filters, periode: 'toutes' }),
    });
  }

  // Duree
  filters.duree.forEach((d) => {
    chips.push({
      key: `duree-${d}`,
      label: DUREE_LABELS[d] || d,
      onRemove: () =>
        onFiltersChange({
          ...filters,
          duree: filters.duree.filter((dur) => dur !== d),
        }),
    });
  });

  // Lieu
  if (filters.lieu.trim()) {
    chips.push({
      key: 'lieu',
      label: filters.lieu,
      onRemove: () => onFiltersChange({ ...filters, lieu: '' }),
    });
  }

  // Thematiques
  filters.thematiques.forEach((theme) => {
    chips.push({
      key: `theme-${theme}`,
      label: theme,
      onRemove: () =>
        onFiltersChange({
          ...filters,
          thematiques: filters.thematiques.filter((t) => t !== theme),
        }),
    });
  });

  if (chips.length === 0) return null;

  const handleResetAll = () => {
    onFiltersChange(DEFAULT_FILTERS);
    onSearchChange('');
  };

  return (
    <div className="bg-primary-50/50 py-2 px-4">
      <div className="max-w-6xl mx-auto flex items-center gap-2 flex-wrap">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-xs font-medium text-primary shadow-sm"
          >
            {chip.label}
            <button
              onClick={chip.onRemove}
              className="p-0.5 hover:bg-primary-100 rounded-full transition"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {chips.length > 1 && (
          <button
            onClick={handleResetAll}
            className="text-xs text-primary-500 hover:text-primary underline ml-2"
          >
            Tout effacer
          </button>
        )}
      </div>
    </div>
  );
}
