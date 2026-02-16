'use client';

import { useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import type { ViewMode } from '@/lib/types';
import {
  AGE_OPTIONS,
  PERIODE_OPTIONS,
  THEMATIQUE_OPTIONS,
  BUDGET_FALLBACK,
  roundBudgetToStep,
} from '@/config/filters';

export interface Filters {
  ages: string[];
  periodes: string[];
  thematiques: string[];
  budgetMax?: number;
}

export const DEFAULT_FILTERS: Filters = {
  ages: [],
  periodes: [],
  thematiques: [],
  budgetMax: undefined,
};

interface BudgetRange {
  min: number;
  max: number;
  step: number;
}

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  resultCount?: number;
  budgetRange?: BudgetRange;
  showBudgetFilter?: boolean;
  mode?: ViewMode;
}

export function FilterSheet({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  resultCount = 0,
  budgetRange = { min: BUDGET_FALLBACK.MIN, max: BUDGET_FALLBACK.MAX, step: BUDGET_FALLBACK.STEP },
  showBudgetFilter = true,
  mode = 'pro',
}: FilterSheetProps) {
  const isKids = mode === 'kids';
  const toggleArrayFilter = (key: 'ages' | 'periodes' | 'thematiques', value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const handleReset = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  const budgetMax = budgetRange.max;
  const hasActiveFilters = filters.ages.length > 0 || filters.periodes.length > 0 ||
    filters.thematiques.length > 0 || (filters.budgetMax !== undefined && filters.budgetMax < budgetMax);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - LOT GRAPHISME 1: More subtle */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet - LOT GRAPHISME 1: Cleaner design */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 shadow-xl">
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header sticky - LOT GRAPHISME 1: Cleaner */}
        <div className="sticky top-0 bg-white z-10 px-5 pb-4 pt-2 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Filtres</h2>
            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Réinitialiser
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition"
                aria-label="Fermer"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
          {/* Result count - LOT GRAPHISME 1: More subtle */}
          <p className="text-sm text-gray-500 mt-1">
            {resultCount} séjour{resultCount !== 1 ? 's' : ''} disponible{resultCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Content - LOT GRAPHISME 1: Better spacing */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
          {/* Période - LOT GRAPHISME 1: Cleaner chips */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-4">Période</h3>
            <div className="flex flex-wrap gap-2">
              {PERIODE_OPTIONS.map(({ value, label }) => {
                const isActive = filters.periodes.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleArrayFilter('periodes', value)}
                    className={`min-h-[44px] px-4 py-2.5 rounded-full text-sm font-medium transition-all border ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Âge - LOT GRAPHISME 1: Cleaner chips */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-4">Âge</h3>
            <div className="flex flex-wrap gap-2">
              {AGE_OPTIONS.map(({ value, label }) => {
                const isActive = filters.ages.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleArrayFilter('ages', value)}
                    className={`min-h-[44px] px-4 py-2.5 rounded-full text-sm font-medium transition-all border ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Thématique - LOT GRAPHISME 1: Cleaner chips, less accent color */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-4">Thématique</h3>
            <div className="flex flex-wrap gap-2">
              {THEMATIQUE_OPTIONS.map(({ value, label }) => {
                const isActive = filters.thematiques.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleArrayFilter('thematiques', value)}
                    className={`min-h-[44px] px-4 py-2.5 rounded-full text-sm font-medium transition-all border ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Budget section - LOT GRAPHISME 1: Cleaner slider, less prominent */}
          {!isKids && showBudgetFilter && (
            <>
              <div className="border-t border-gray-100" />
              <section>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Budget max</h3>
                <div className="px-2">
                  <input
                    type="range"
                    min={budgetRange.min}
                    max={budgetRange.max}
                    step={budgetRange.step}
                    value={filters.budgetMax ?? budgetRange.max}
                    onChange={(e) => onFiltersChange({ ...filters, budgetMax: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between mt-3 text-sm">
                    <span className="text-gray-500">{budgetRange.min}€</span>
                    <span className="text-gray-500">{budgetRange.max}€</span>
                  </div>
                  <div className="mt-4 text-center">
                    <span className="text-base font-semibold text-gray-900">
                      {filters.budgetMax === undefined || filters.budgetMax >= budgetRange.max
                        ? 'Tous les budgets'
                        : `${filters.budgetMax}€ max`}
                    </span>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer CTA - LOT GRAPHISME 1: More subtle */}
        <div className="p-5 border-t border-gray-200 pb-safe bg-white">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold text-base hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
          >
            Voir {resultCount} séjour{resultCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>
  );
}
