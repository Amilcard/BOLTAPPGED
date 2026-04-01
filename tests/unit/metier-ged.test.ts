/**
 * Tests unitaires — Logique métier GED
 *
 * Couvre les fonctions pures à forte valeur métier :
 *  - Calcul prix GED (surcoûts durée, supplément ville, promo)
 *  - Validation ville GED (supplément transport)
 *  - Calcul et validation âge enfant à la date de session
 *  - Durée de séjour (inclusive)
 *  - Mapping date → saison
 *  - Génération de slug URL
 *
 * 0 mock nécessaire — toutes ces fonctions sont pures.
 */

import { calculateGedPrice, isGedCity } from '@/lib/pricing';
import { calculateAgeAtDate, validateChildAge, generateSlug } from '@/lib/utils';
import { getDurationDays, mapDateToSeason } from '@/lib/age-utils';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CALCUL PRIX GED — calculateGedPrice()
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateGedPrice()', () => {
  /**
   * Règles :
   *   7j  → +180€ surcoût
   *  14j  → +240€ surcoût
   *  21j  → +410€ surcoût
   *   6j  → prorata(6/14 × 240) = arrondi → +103€
   *   8j  → prorata(8/14 × 240) = arrondi → +137€
   *  12j  → prorata(12/14 × 240) = arrondi → +206€
   *  13j  → prorata(13/14 × 240) = arrondi → +223€
   * ville GED → +18€
   * promo   → ×0.95 (arrondi Math.round)
   */

  it('7j sans ville, avec promo — cas de base', () => {
    // (615 + 180) × 0.95 = 795 × 0.95 = 755.25 → arrondi 755
    expect(calculateGedPrice(615, 7, '', true)).toBe(755);
  });

  it('7j avec ville GED (Paris), avec promo — supplément +18€ appliqué', () => {
    // (615 + 180 + 18) × 0.95 = 813 × 0.95 = 772.35 → 772
    expect(calculateGedPrice(615, 7, 'Paris', true)).toBe(772);
  });

  it('casse insensible pour la ville (PARIS, paris, Paris)', () => {
    const ref = calculateGedPrice(615, 7, 'paris', true);
    expect(calculateGedPrice(615, 7, 'PARIS', true)).toBe(ref);
    expect(calculateGedPrice(615, 7, 'Paris', true)).toBe(ref);
  });

  it('14j sans ville, avec promo', () => {
    // (400 + 240) × 0.95 = 640 × 0.95 = 608
    expect(calculateGedPrice(400, 14, '', true)).toBe(608);
  });

  it('21j sans ville, avec promo', () => {
    // (500 + 410) × 0.95 = 910 × 0.95 = 864.5 → 865
    expect(calculateGedPrice(500, 21, '', true)).toBe(865);
  });

  it('prorata 6j — surcoût proportionnel à la référence 14j', () => {
    // prorata = Math.round((240 / 14) × 6) = Math.round(102.86) = 103
    // (400 + 103) × 0.95 = 503 × 0.95 = 477.85 → 478
    expect(calculateGedPrice(400, 6, '', true)).toBe(478);
  });

  it('promo désactivée — pas de ×0.95', () => {
    // 7j sans promo : 615 + 180 = 795 (pas de ×0.95)
    expect(calculateGedPrice(615, 7, '', false)).toBe(795);
  });

  it('ville hors liste GED — pas de supplément transport', () => {
    const avecVilleGed = calculateGedPrice(600, 7, 'Paris', false);
    const sansVilleGed = calculateGedPrice(600, 7, 'Saint-Tropez', false);
    // Différence doit être exactement 18€
    expect(avecVilleGed - sansVilleGed).toBe(18);
  });

  it('prix UFOVAL = 0 — surcoût seul, promo appliquée', () => {
    // (0 + 180) × 0.95 = 171
    expect(calculateGedPrice(0, 7, '', true)).toBe(171);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. VALIDATION VILLE GED — isGedCity()
// ─────────────────────────────────────────────────────────────────────────────

describe('isGedCity()', () => {
  it('ville GED connue → true', () => {
    expect(isGedCity('paris')).toBe(true);
    expect(isGedCity('Lyon')).toBe(true);
    expect(isGedCity('GRENOBLE')).toBe(true);
  });

  it('ville hors liste → false', () => {
    expect(isGedCity('Nice')).toBe(false);
    expect(isGedCity('Montpellier')).toBe(false);
  });

  it('"sans_transport" → false (absence de transport, pas une ville)', () => {
    expect(isGedCity('sans_transport')).toBe(false);
    expect(isGedCity('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CALCUL ÂGE À UNE DATE — calculateAgeAtDate()
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateAgeAtDate()', () => {
  it("age exact quand l'anniversaire est deja passe dans l'annee", () => {
    // Né le 01/01/2015, session le 01/07/2026 → 11 ans
    expect(calculateAgeAtDate('2015-01-01', '2026-07-01')).toBe(11);
  });

  it("age -1 quand l'anniversaire n'est pas encore passe dans l'annee", () => {
    // Né le 31/12/2015, session le 01/07/2026 → 10 ans (pas encore 11)
    expect(calculateAgeAtDate('2015-12-31', '2026-07-01')).toBe(10);
  });

  it("exactement le jour de l'anniversaire → compte comme passe", () => {
    // Né le 15/07/2015, session le 15/07/2026 → 11 ans
    expect(calculateAgeAtDate('2015-07-15', '2026-07-15')).toBe(11);
  });

  it('date invalide → null', () => {
    expect(calculateAgeAtDate('not-a-date', '2026-07-01')).toBeNull();
    expect(calculateAgeAtDate('2015-01-01', 'invalid')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. VALIDATION ÂGE ENFANT — validateChildAge()
//    Règle GED : 3–17 ans à la date de départ
// ─────────────────────────────────────────────────────────────────────────────

describe('validateChildAge()', () => {
  const SESSION = '2026-07-08';

  it('enfant dans la tranche → valid = true, message = null', () => {
    // Né le 01/01/2018 → 8 ans en juillet 2026 → OK pour 6-12 ans
    const result = validateChildAge('2018-01-01', SESSION, 6, 12);
    expect(result.valid).toBe(true);
    expect(result.age).toBe(8);
    expect(result.message).toBeNull();
  });

  it('enfant trop jeune → valid = false, message mentionne les âges du séjour', () => {
    // Né le 01/01/2023 → 3 ans en juillet 2026 → trop jeune pour 6-12 ans
    const result = validateChildAge('2023-01-01', SESSION, 6, 12);
    expect(result.valid).toBe(false);
    expect(result.age).toBe(3);
    expect(result.message).toContain('6');
    expect(result.message).toContain('12');
  });

  it('enfant trop vieux → valid = false', () => {
    // Né le 01/01/2005 → 21 ans en juillet 2026 → trop vieux pour 6-12 ans
    const result = validateChildAge('2005-01-01', SESSION, 6, 12);
    expect(result.valid).toBe(false);
    expect(result.age).toBe(21);
  });

  it('dates manquantes → valid = false, âge = null', () => {
    const result = validateChildAge('', SESSION, 3, 17);
    expect(result.valid).toBe(false);
    expect(result.age).toBeNull();
  });

  it('exactement à la borne supérieure → valid = true (inclusif)', () => {
    // Né le 01/01/2009 → 17 ans en juillet 2026 → OK pour 3-17 ans
    const result = validateChildAge('2009-01-01', SESSION, 3, 17);
    expect(result.valid).toBe(true);
    expect(result.age).toBe(17);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. DURÉE DE SÉJOUR — getDurationDays()
// ─────────────────────────────────────────────────────────────────────────────

describe('getDurationDays()', () => {
  it('même jour → 1 jour', () => {
    expect(getDurationDays('2026-07-08', '2026-07-08')).toBe(1);
  });

  it('7 jours inclusifs (départ sam, retour ven)', () => {
    expect(getDurationDays('2026-07-04', '2026-07-10')).toBe(7);
  });

  it('14 jours', () => {
    expect(getDurationDays('2026-07-04', '2026-07-17')).toBe(14);
  });

  it('dates invalides → 0', () => {
    expect(getDurationDays('invalid', '2026-07-10')).toBe(0);
    expect(getDurationDays('2026-07-04', 'bad')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. MAPPING DATE → SAISON — mapDateToSeason()
// ─────────────────────────────────────────────────────────────────────────────

describe('mapDateToSeason()', () => {
  it('juillet → été', () => expect(mapDateToSeason('2026-07-15')).toBe('été'));
  it('janvier → hiver', () => expect(mapDateToSeason('2026-01-15')).toBe('hiver'));
  it('avril → printemps', () => expect(mapDateToSeason('2026-04-10')).toBe('printemps'));
  it('octobre → automne', () => expect(mapDateToSeason('2026-10-20')).toBe('automne'));
  it('décembre → fin-annee', () => expect(mapDateToSeason('2026-12-25')).toBe('fin-annee'));
  it('date invalide → fallback "été"', () => expect(mapDateToSeason('not-a-date')).toBe('été'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. GÉNÉRATION SLUG — generateSlug()
// ─────────────────────────────────────────────────────────────────────────────

describe('generateSlug()', () => {
  it('supprime les accents', () => {
    expect(generateSlug('Séjour Été Montagne')).toBe('sejour-ete-montagne');
  });

  it('convertit en minuscules', () => {
    expect(generateSlug('ALPES AVENTURE')).toBe('alpes-aventure');
  });

  it('remplace les espaces par des tirets', () => {
    expect(generateSlug('colo de rêve')).toBe('colo-de-reve');
  });

  it('supprime les caractères spéciaux (apostrophe, point, !)', () => {
    expect(generateSlug("L'Île d'Oléron")).toBe('l-ile-d-oleron');
  });

  it('pas de tiret en début ou en fin', () => {
    const slug = generateSlug('  Séjour enfants  ');
    expect(slug).not.toMatch(/^-|-$/);
    expect(slug).toBe('sejour-enfants');
  });
});
