import { getStayAgeData, getStayDurationDays, getStayPeriod } from '@/lib/age-utils';

/**
 * Mappe les données DB brutes (gd_stays + sessions + themes) vers le format attendu par StayDetail.
 * Centralise la transformation pour éviter le couplage schema DB ↔ props UI dans le composant SSR.
 */
export function mapDbStayToViewModel(
  stay: Record<string, unknown>,
  sessionPrices: Array<Record<string, unknown>>,
  staySessions: Array<Record<string, unknown>>,
  departureCities: Array<{ city: string; extra_eur: number }>,
  sessionPricesFormatted: unknown[],
  themesMap: Record<string, string[]>,
) {
  // Calcul unifié âges + durée
  const sessionAgeData = staySessions.map(s => ({ age_min: (s.age_min as number) ?? 0, age_max: (s.age_max as number) ?? 0 }));
  const { ageMin, ageMax, ageRangesDisplay } = getStayAgeData(
    sessionAgeData,
    (stay.age_min as number) ?? 0,
    (stay.age_max as number) ?? 0
  );
  const sessionDateData = staySessions.map(s => ({ start_date: (s.start_date as string) ?? '', end_date: (s.end_date as string) ?? '' }));
  const durationDays = getStayDurationDays(sessionDateData, 7);

  // Dédupliquer sessions par dates
  const sessionsMap = new Map<string, Record<string, unknown>>();
  for (const s of sessionPrices) {
    const key = `${s.start_date}-${s.end_date}`;
    if (!sessionsMap.has(key)) {
      sessionsMap.set(key, s);
    }
  }
  const uniqueSessions = Array.from(sessionsMap.values());

  // Parse price_includes_features
  const priceIncludesRaw = stay.price_includes_features;
  const priceIncludesFeatures: string[] | null = Array.isArray(priceIncludesRaw)
    ? (priceIncludesRaw as unknown[]).filter((x): x is string => typeof x === 'string')
    : null;

  const slug = stay.slug as string;

  return {
    id: slug,
    slug,
    title: (stay.marketing_title as string) || 'Séjour',
    descriptionShort: (stay.punchline as string) || (stay.expert_pitch as string) || '',
    titlePro: undefined,
    titleKids: undefined,
    descriptionPro: undefined,
    descriptionKids: undefined,
    programme: Array.isArray(stay.programme)
      ? (stay.programme as unknown[]).filter((x): x is string => typeof x === 'string')
      : stay.programme
        ? String(stay.programme).split('\n').filter(Boolean)
        : [],
    geography: (stay.location_region as string) || (stay.location_city as string) || '',
    accommodation: (stay.centre_name as string) || '',
    supervision: 'Équipe Groupe & Découverte',
    durationDays,
    period: getStayPeriod(sessionDateData, 'été'),
    ageMin,
    ageMax,
    ageRangesDisplay,
    themes: themesMap[slug] || [],
    imageCover: (Array.isArray(stay.images) ? (stay.images as string[])[0] : '') || '',
    images: Array.isArray(stay.images) ? (stay.images as string[]) : [],
    published: true,
    createdAt: (stay.created_at as string) || new Date().toISOString(),
    updatedAt: (stay.updated_at as string) || new Date().toISOString(),
    departureCity: null,
    educationalOption: null,
    geoLabel: (stay.location_city as string) || null,
    geoPrecision: (stay.location_region as string) || null,
    accommodationLabel: (stay.centre_name as string) || undefined,
    contentKids: {
      departureCities,
      sessionsFormatted: sessionPricesFormatted,
    },
    sourceUrl: (stay.source_url as string) || null,
    pdfUrl: (stay.pdf_url as string) || null,
    price_base: uniqueSessions.length > 0
      ? Math.min(...uniqueSessions.map(s => (s.price_ged_total as number) || Infinity).filter(isFinite))
      : null,
    price_unit: '€',
    pro_price_note: 'Tarif communiqué aux professionnels',
    sessions: uniqueSessions.map((s) => ({
      id: `${slug}__${s.start_date}__${s.end_date}`,
      stayId: slug,
      startDate: s.start_date as string,
      endDate: s.end_date as string,
      seatsLeft: (s as { is_full?: boolean }).is_full === true ? 0 : -1,
    })),
    rawSessions: staySessions,
    marketingTitle: (stay.marketing_title as string) || null,
    punchline: (stay.punchline as string) || null,
    expertPitch: (stay.expert_pitch as string) || null,
    emotionTag: (stay.emotion_tag as string) || null,
    carouselGroup: (stay.carousel_group as string) || null,
    spotLabel: (stay.spot_label as string) || null,
    standingLabel: (stay.standing_label as string) || null,
    expertiseLabel: (stay.expertise_label as string) || null,
    intensityLabel: (stay.intensity_label as string) || null,
    priceIncludesFeatures,
  };
}
