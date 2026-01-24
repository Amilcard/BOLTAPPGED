'use client';

import { useApp } from './providers';
import type { PeriodFilter as PeriodFilterType } from '@/lib/types';

const periods: { value: PeriodFilterType; label: string }[] = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'printemps', label: 'Printemps' },
  { value: 'été', label: 'Été' },
];

export function PeriodFilter() {
  const { periodFilter, setPeriodFilter, mounted } = useApp();

  if (!mounted) return <div className="h-10" />;

  return (
    <div className="flex gap-2">
      {periods.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setPeriodFilter(value)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            periodFilter === value
              ? 'bg-primary text-white shadow-md'
              : 'bg-white text-primary-600 hover:bg-primary-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
