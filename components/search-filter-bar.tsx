'use client';

import { Search, SlidersHorizontal } from 'lucide-react';

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenFilters: () => void;
  activeFiltersCount: number;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  onOpenFilters,
  activeFiltersCount,
}: SearchFilterBarProps) {
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-primary-100 py-3 px-4">
      <div className="max-w-6xl mx-auto flex gap-3">
        {/* Filter Button */}
        <button
          onClick={onOpenFilters}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 text-primary rounded-lg hover:bg-primary-100 transition-colors shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline text-sm font-medium">Filtrer</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 bg-accent text-white text-xs font-bold rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un séjour…"
            className="w-full pl-10 pr-4 py-2.5 bg-primary-50 border-0 rounded-lg text-sm text-primary placeholder:text-primary-400 focus:ring-2 focus:ring-accent focus:bg-white transition-all"
          />
        </div>
      </div>
    </div>
  );
}
