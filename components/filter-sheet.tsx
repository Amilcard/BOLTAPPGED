'use client';

import { X, RotateCcw } from 'lucide-react';
import type { PeriodFilter } from '@/lib/types';

export interface Filters {
  ages: string[];
  periode: PeriodFilter;
  duree: string[];
  lieu: string;
  thematiques: string[];
}

export const DEFAULT_FILTERS: Filters = {
  ages: [],
  periode: 'toutes',
  duree: [],
  lieu: '',
  thematiques: [],
};

const AGE_PRESETS = [
  { value: '3-5', label: '3-5 ans' },
  { value: '6-10', label: '6-10 ans' },
  { value: '11-17', label: '11-17 ans' },
];

const DUREE_PRESETS = [
  { value: '1-7', label: '1-7 jours' },
  { value: '8-14', label: '8-14 jours' },
  { value: '15+', label: '15+ jours' },
];

const PERIODE_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'printemps', label: 'Printemps' },
  { value: 'été', label: 'Été' },
];

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableThemes: string[];
  resultCount?: number;
}

export function FilterSheet({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  availableThemes,
  resultCount = 0,
}: FilterSheetProps) {
  const toggleArrayFilter = (key: 'ages' | 'duree' | 'thematiques', value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const handleReset = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  const hasActiveFilters = filters.ages.length > 0 || filters.periode !== 'toutes' || 
    filters.duree.length > 0 || filters.lieu.trim() !== '' || filters.thematiques.length > 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-primary-200 rounded-full" />
        </div>

        {/* Header sticky */}
        <div className="sticky top-0 bg-white z-10 px-5 pb-4 pt-2 border-b border-primary-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">Filtres</h2>
            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent hover:text-accent-600 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Réinitialiser
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 -mr-2 hover:bg-primary-50 rounded-full transition"
                aria-label="Fermer"
              >
                <X className="w-5 h-5 text-primary-400" />
              </button>
            </div>
          </div>
          {/* Result count badge */}
          <p className="text-sm text-primary-500 mt-1">
            {resultCount} séjour{resultCount !== 1 ? 's' : ''} disponible{resultCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Ages */}
          <section>
            <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wide mb-3">Âge des enfants</h3>
            <div className="flex flex-wrap gap-2">
              {AGE_PRESETS.map(({ value, label }) => {
                const isActive = filters.ages.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleArrayFilter('ages', value)}
                    className={`min-h-[44px] px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2 ${
                      isActive
                        ? 'bg-primary border-primary text-white shadow-md'
                        : 'bg-white border-primary-200 text-primary-700 hover:border-primary-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="border-t border-primary-100" />

          {/* Periode */}
          <section>
            <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wide mb-3">Période</h3>
            <div className="flex flex-wrap gap-2">
              {PERIODE_OPTIONS.map(({ value, label }) => {
                const isActive = filters.periode === value;
                return (
                  <button
                    key={value}
                    onClick={() => onFiltersChange({ ...filters, periode: value })}
                    className={`min-h-[44px] px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2 ${
                      isActive
                        ? 'bg-primary border-primary text-white shadow-md'
                        : 'bg-white border-primary-200 text-primary-700 hover:border-primary-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="border-t border-primary-100" />

          {/* Duree */}
          <section>
            <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wide mb-3">Durée</h3>
            <div className="flex flex-wrap gap-2">
              {DUREE_PRESETS.map(({ value, label }) => {
                const isActive = filters.duree.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleArrayFilter('duree', value)}
                    className={`min-h-[44px] px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2 ${
                      isActive
                        ? 'bg-primary border-primary text-white shadow-md'
                        : 'bg-white border-primary-200 text-primary-700 hover:border-primary-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="border-t border-primary-100" />

          {/* Lieu */}
          <section>
            <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wide mb-3">Lieu</h3>
            <input
              type="text"
              value={filters.lieu}
              onChange={(e) => onFiltersChange({ ...filters, lieu: e.target.value })}
              placeholder="Ex: Alpes, Bretagne, Auvergne…"
              className="w-full min-h-[44px] px-4 py-3 bg-primary-50 border-2 border-transparent rounded-xl text-sm text-primary placeholder:text-primary-400 focus:border-primary focus:ring-0 transition"
            />
          </section>

          {/* Thematiques */}
          {availableThemes.length > 0 && (
            <>
              <div className="border-t border-primary-100" />
              <section>
                <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wide mb-3">Thématiques</h3>
                <div className="flex flex-wrap gap-2">
                  {availableThemes.map((theme) => {
                    const isActive = filters.thematiques.includes(theme);
                    return (
                      <button
                        key={theme}
                        onClick={() => toggleArrayFilter('thematiques', theme)}
                        className={`min-h-[44px] px-4 py-2.5 rounded-full text-sm font-semibold transition-all border-2 ${
                          isActive
                            ? 'bg-accent border-accent text-white shadow-md'
                            : 'bg-white border-primary-200 text-primary-700 hover:border-accent'
                        }`}
                      >
                        {theme}
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer with CTA */}
        <div className="p-5 border-t border-primary-100 pb-safe bg-white">
          <button
            onClick={onClose}
            className="w-full py-4 bg-accent text-white rounded-2xl font-bold text-base hover:bg-accent-600 transition-all shadow-lg active:scale-[0.98]"
          >
            Voir {resultCount} séjour{resultCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>
  );
}
