/**
 * Filter Configuration (LOT 1)
 *
 * Single source of truth for all filter-related constants.
 * Budget min/max are calculated dynamically from stays, with fallback values here.
 */

// ==============================
// AGE FILTER OPTIONS
// ==============================
// Aligned with carousel age groups (6-8, 9-11, 12-14, 15-17)
export const AGE_OPTIONS = [
  { value: '6-8', label: '6-8 ans', minAge: 6, maxAge: 8 },
  { value: '9-11', label: '9-11 ans', minAge: 9, maxAge: 11 },
  { value: '12-14', label: '12-14 ans', minAge: 12, maxAge: 14 },
  { value: '15-17', label: '15-17 ans', minAge: 15, maxAge: 17 },
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
// Aligné avec gd_stay_themes (5 thèmes)
// ==============================
export const THEMATIQUE_OPTIONS = [
  { value: 'MER', label: 'Mer & Plage' },
  { value: 'MONTAGNE', label: 'Montagne' },
  { value: 'SPORT', label: 'Sport' },
  { value: 'DECOUVERTE', label: 'Découverte' },
  { value: 'PLEIN_AIR', label: 'Plein Air' },
] as const;

// Keyword mapping pour filtrage par thème
// Les valeurs correspondent exactement aux thèmes dans gd_stay_themes
export const THEMATIQUE_KEYWORDS: Record<string, string[]> = {
  MER: ['mer', 'plage', 'balnéaire', 'nautique', 'océan', 'bord de mer', 'balneaire'],
  MONTAGNE: ['montagne', 'alpes', 'ski', 'randonnée', 'altitude', 'sommet'],
  SPORT: ['sport', 'foot', 'basket', 'tennis', 'natation', 'rugby', 'volley', 'gymnastique'],
  DECOUVERTE: ['découverte', 'culture', 'histoire', 'patrimoine', 'musée', 'visite', 'decouverte'],
  PLEIN_AIR: ['nature', 'plein air', 'forêt', 'campagne', 'parc', 'extérieur', 'plein_air'],
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
 *   - Calculated from: gd_stay_sessions (age_min, age_max per session)
 *   - Exposed fields: stay.ageMin (global min), stay.ageMax (global max), stay.ageRangesDisplay (detailed ranges)
 *   - Filter logic: Overlap check between stay age range and selected filters
 *   - Example: stay with ageMin=6, ageMax=12 matches filters '6-8' AND '9-11'
 *
 * Thématique:
 *   - DB field: stay.themes (string[]) - populated from gd_stay_themes table
 *   - Values: MER, MONTAGNE, SPORT, DECOUVERTE, PLEIN_AIR
 *   - Filter logic: Direct match + keyword fallback via THEMATIQUE_KEYWORDS
 *   - Multi-thèmes: Un séjour peut avoir plusieurs thèmes
 *
 * Budget:
 *   - DB field: stay.priceFrom (number | undefined)
 *   - Note: Price is NOT exposed in public API (only for authenticated pros)
 *   - Filter logic: stay.priceFrom <= budgetMax
 *   - Fallback: If no prices visible, filter is disabled/hidden
 */
