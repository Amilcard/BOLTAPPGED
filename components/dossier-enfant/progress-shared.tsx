'use client';

/**
 * Progression visuelle par bloc dossier enfant.
 *
 * Déciosion produit (2026-04-19) : variante "% réelle" par bloc — on compte
 * les champs requis métiers remplis / total. La barre est verte à 100%.
 *
 * Chaque form expose sa propre liste de champs requis (source de vérité locale).
 * Mutualiser un "manifest" global serait fragile (les champs bougent au gré
 * des formulaires légaux).
 */

import React from 'react';

export type ProgressColor = 'orange' | 'blue' | 'red' | 'purple';

export function computeProgress(
  form: Record<string, unknown>,
  fields: string[],
): { filled: number; total: number } {
  const filled = fields.filter(k => {
    const v = form[k];
    if (typeof v === 'boolean') return v === true;
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'number') return true;
    return v !== null && v !== undefined && v !== '';
  }).length;
  return { filled, total: fields.length };
}

// Classes Tailwind complètes pour éviter la purge CSS
const BAR_CLASS: Record<ProgressColor, string> = {
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
};

export function ProgressBar({
  label, filled, total, color,
}: {
  label: string;
  filled: number;
  total: number;
  color: ProgressColor;
}) {
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
  const isComplete = filled === total;
  return (
    <div className="mb-2" data-testid={`progress-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">
          {isComplete ? (
            <span className="text-green-700">{label} — Complet</span>
          ) : (
            <span className="text-gray-600">{label} — {pct}% complété</span>
          )}
        </span>
        <span className="text-gray-400">{filled}/{total}</span>
      </div>
      <div
        className="h-1.5 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} : ${pct}% complété`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : BAR_CLASS[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
