import { getSejours, supabaseGed, getAllStayThemes, getMinPricesBySlug } from '@/lib/supabaseGed';
import type { Stay } from '@/lib/types';
import { getStayAgeData, getStayDurationDays, getStayPeriod } from '@/lib/age-utils';

/**
 * Fetch et mapping des séjours depuis Supabase.
 * Partagé entre page.tsx (carousels) et recherche/page.tsx (grid).
 *
 * Fallback âge : 3-17 ans (tranche GED globale) si absent en DB.
 */
export async function getStaysData(): Promise<Stay[]> {
  const [sejoursGed, agesData, themesMap, pricesMap] = await Promise.all([
    getSejours(),
    supabaseGed.from('gd_stay_sessions')
      .select('stay_slug, age_min, age_max, start_date, end_date')
      .then(({ data }) => data || []),
    getAllStayThemes(),
    getMinPricesBySlug()
  ]);

  // Map slug → sessions
  const sessionsMap = new Map<string, Array<{ age_min: number; age_max: number; start_date: string; end_date: string }>>();
  for (const row of agesData) {
    if (!sessionsMap.has(row.stay_slug)) {
      sessionsMap.set(row.stay_slug, []);
    }
    sessionsMap.get(row.stay_slug)?.push({
      age_min: row.age_min ?? 3,
      age_max: row.age_max ?? 17,
      start_date: row.start_date ?? '',
      end_date: row.end_date ?? '',
    });
  }

  return sejoursGed.map(sejour => {
    const sessions = sessionsMap.get(sejour.slug) || [];

    // Fallback âge : 3-17 (tranche GED globale)
    const { ageMin, ageMax, ageRangesDisplay } = getStayAgeData(
      sessions,
      sejour.age_min ?? 3,
      sejour.age_max ?? 17
    );
    const durationDays = getStayDurationDays(sessions, 7);
    const stayThemes = themesMap[sejour.slug] || [];

    const priceIncludesRaw = sejour.price_includes_features;
    const priceIncludesFeatures: string[] | null = Array.isArray(priceIncludesRaw)
      ? priceIncludesRaw
      : null;

    return {
      id: sejour.slug,
      slug: sejour.slug,
      title: sejour.marketing_title || 'Séjour',
      descriptionShort: sejour.punchline || sejour.expert_pitch || '',
      titlePro: undefined,
      titleKids: undefined,
      descriptionPro: undefined,
      descriptionKids: undefined,
      programme: sejour.programme ? sejour.programme.split('\n').filter(Boolean) : [],
      geography: sejour.location_region || sejour.location_city || '',
      accommodation: sejour.centre_name || '',
      supervision: 'Équipe Groupe & Découverte',
      durationDays,
      priceFrom: pricesMap[sejour.slug] || undefined,
      period: getStayPeriod(sessions, 'été'),
      ageMin,
      ageMax,
      ageRangesDisplay,
      themes: stayThemes,
      imageCover: sejour.images?.[0] || '',
      published: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextSessionStart: null,
      sessions: sessions
        .filter(s => s.start_date && s.end_date)
        .map((s) => ({
          id: `${sejour.slug}__${s.start_date}__${s.end_date}`,
          stayId: sejour.slug,
          startDate: s.start_date,
          endDate: s.end_date,
          seatsLeft: -1,
        })),
      marketingTitle: sejour.marketing_title || null,
      punchline: sejour.punchline || null,
      expertPitch: sejour.expert_pitch || null,
      emotionTag: sejour.emotion_tag || null,
      carouselGroup: sejour.carousel_group || null,
      spotLabel: sejour.spot_label || null,
      standingLabel: sejour.standing_label || null,
      expertiseLabel: sejour.expertise_label || null,
      intensityLabel: sejour.intensity_label || null,
      priceIncludesFeatures,
    };
  });
}
