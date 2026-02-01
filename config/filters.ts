/**
 * Filter Configuration (LOT 1)
 *
 * Single source of truth for all filter-related constants.
 * Budget min/max are calculated dynamically from stays, with fallback values here.
 */

// ==============================
// AGE FILTER OPTIONS
// ==============================
export const AGE_OPTIONS = [
  { value: '3-7', label: '3-7 ans', minAge: 3, maxAge: 7 },
  { value: '8-11', label: '8-11 ans', minAge: 8, maxAge: 11 },
  { value: '12-14', label: '12-14 ans', minAge: 12, maxAge: 14 },
  { value: '15+', label: '15 ans et +', minAge: 15, maxAge: 99 },
] as const;

// ==============================
// PERIODE FILTER OPTIONS
// ==============================
export const PERIODE_OPTIONS = [
  { value: 'hiver', label: 'Hiver' },
  { value: 'printemps', label: 'Printemps' },
  { value: 'été', label: 'Été' },
  { value: 'automne', label: 'Automne' },
  { value: 'fin-annee', label: "Fin d'année" },
] as const;

// ==============================
// THEMATIQUE FILTER OPTIONS
// ==============================
export const THEMATIQUE_OPTIONS = [
  { value: 'sport', label: 'Sport' },
  { value: 'decouverte', label: 'Découverte' },
  { value: 'plein-air', label: 'Plein air' },
  { value: 'balneaire', label: 'Balnéaire' },
  { value: 'montagne', label: 'Montagne' },
] as const;

// Keyword mapping for thematique filter (since DB doesn't have exact field)
export const THEMATIQUE_KEYWORDS: Record<string, string[]> = {
  sport: ['sport', 'foot', 'basket', 'tennis', 'natation', 'rugby', 'volley', 'gymnastique'],
  decouverte: ['découverte', 'culture', 'histoire', 'patrimoine', 'musée', 'visite'],
  'plein-air': ['nature', 'plein air', 'forêt', 'campagne', 'parc', 'extérieur'],
  balneaire: ['mer', 'plage', 'balnéaire', 'nautique', 'océan', 'bord de mer'],
  montagne: ['montagne', 'alpes', 'ski', 'randonnée', 'altitude', 'sommet'],
};

// ==============================
// BUDGET FILTER CONFIG
// ==============================
// Fallback values when no stays have prices (public view)
export const BUDGET_FALLBACK = {
  MIN: 0,
  MAX: 2000,
  STEP: 50,
} as const;

// Round budget to nearest step (50€)
export function roundBudgetToStep(value: number, step: number = BUDGET_FALLBACK.STEP): number {
  return Math.round(value / step) * step;
}

// Calculate budget range from stays (Option A)
export function calculateBudgetRange(prices: number[]): { min: number; max: number; step: number } {
  const validPrices = prices.filter((p) => p != null && p > 0);

  if (validPrices.length === 0) {
    return { min: BUDGET_FALLBACK.MIN, max: BUDGET_FALLBACK.MAX, step: BUDGET_FALLBACK.STEP };
  }

  const min = Math.min(...validPrices);
  const max = Math.max(...validPrices);

  // Round max up to next 100 for better UX
  const roundedMax = Math.ceil(max / 100) * 100;

  return {
    min: roundBudgetToStep(min),
    max: roundedMax,
    step: BUDGET_FALLBACK.STEP,
  };
}

// ==============================
// DATABASE FIELD MAPPING
// ==============================
/**
 * DOCUMENTATION: Which real DB fields are used for each filter
 *
 * Période:
 *   - DB field: stay.period (string)
 *   - Filter logic: Direct string match
 *   - Values: 'hiver' | 'printemps' | 'été' | 'automne' | 'fin-annee'
 *
 * Âge:
 *   - DB fields: stay.ageMin (number), stay.ageMax (number)
 *   - Filter logic: Overlap check between stay age range and selected filters
 *   - Example: stay with ageMin=6, ageMax=12 matches filters '3-7' AND '8-11'
 *
 * Thématique:
 *   - DB field: stay.themes (string[])
 *   - Filter logic: Keyword matching via THEMATIQUE_KEYWORDS mapping
 *   - Fallback: No exact field in DB, so we match by keywords
 *
 * Budget:
 *   - DB field: stay.priceFrom (number | undefined)
 *   - Note: Price is NOT exposed in public API (only for authenticated pros)
 *   - Filter logic: stay.priceFrom <= budgetMax
 *   - Fallback: If no prices visible, filter is disabled/hidden
 */
