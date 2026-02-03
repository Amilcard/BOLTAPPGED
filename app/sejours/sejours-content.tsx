'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { HomeContent } from '../home-content';
import { FilterSheet, type Filters, DEFAULT_FILTERS } from '@/components/filter-sheet';
import type { Stay } from '@/lib/types';

interface SejoursContentProps {
  stays: Stay[];
}

export function SejoursContent({ stays }: SejoursContentProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  return (
    <>
      {/* Airbnb-style Search Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 flex items-center gap-3 px-6 py-3.5 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-shadow">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Rechercher une destination, une activité..."
                className="flex-1 text-sm text-gray-900 placeholder-gray-500 bg-transparent border-none outline-none focus:ring-0"
                disabled
              />
            </div>

            {/* Filtres Button */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="flex items-center gap-2 px-5 py-3.5 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-700 hidden sm:inline">Filtres</span>
            </button>
          </div>
        </div>
      </div>

      <HomeContent stays={stays} hideInternalSearch={true} />

      <FilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={stays.length}
      />
    </>
  );
}
