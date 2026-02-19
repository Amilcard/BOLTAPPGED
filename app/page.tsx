import { getSejours, supabaseGed, getAllStayThemes, getMinPricesBySlug } from '@/lib/supabaseGed';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { HomeContent } from '@/app/home-content';
import type { Stay } from '@/lib/types';
import { getStayAgeData, getStayDurationDays, getStayPeriod } from '@/lib/age-utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Force revalidation timestamp: 2026-02-06 13:10 (Verification Round 4)
  // Récupérer séjours + âges + thèmes depuis Supabase
  const [sejoursGed, agesData, themesMap, pricesMap] = await Promise.all([
    getSejours(),
    supabaseGed.from('gd_stay_sessions')
      .select('stay_slug, age_min, age_max, start_date, end_date')
      .then(({ data }) => data || []),
    getAllStayThemes(),
    getMinPricesBySlug()
  ]);

  // Créer un map slug → sessions pour calcul unifié des âges ET durées
  const sessionsMap = new Map<string, Array<{ age_min: number; age_max: number; start_date: string; end_date: string }>>();
  for (const row of agesData) {
    if (!sessionsMap.has(row.stay_slug)) {
      sessionsMap.set(row.stay_slug, []);
    }
    sessionsMap.get(row.stay_slug)!.push({
      age_min: row.age_min,
      age_max: row.age_max,
      start_date: row.start_date,
      end_date: row.end_date,
    });
  }

  // Mapper les données GED vers le type Stay attendu
  const staysData: Stay[] = sejoursGed.map(sejour => {
    const sessions = sessionsMap.get(sejour.slug) || [];

    // Sprint 1: Calcul unifié âges + durée via helpers centralisés
    const { ageMin, ageMax, ageRangesDisplay } = getStayAgeData(sessions);
    const durationDays = getStayDurationDays(sessions, 7);

    // Récupérer les thèmes depuis gd_stay_themes (multi-thèmes)
    const stayThemes = themesMap[sejour.slug] || [];

    // Parse price_includes_features (jsonb → string[])
    const priceIncludesRaw = sejour.price_includes_features;
    const priceIncludesFeatures: string[] | null = Array.isArray(priceIncludesRaw)
      ? priceIncludesRaw
      : null;

    return {
      id: sejour.slug,
      slug: sejour.slug,
      // NEUTRALISÉ: Les champs legacy UFOVAL ne sont plus transmis au front
      // On garde la structure Stay mais avec valeurs CityCrunch uniquement
      title: sejour.marketing_title || 'Séjour', // CityCrunch title, jamais l'ancien nom UFOVAL
      descriptionShort: sejour.punchline || sejour.expert_pitch || '',
      titlePro: undefined, // ARCHIVE ONLY — neutralisé
      titleKids: undefined, // ARCHIVE ONLY — neutralisé
      descriptionPro: undefined, // ARCHIVE ONLY — neutralisé
      descriptionKids: undefined, // ARCHIVE ONLY — neutralisé
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
      themes: stayThemes, // Multi-thèmes depuis gd_stay_themes
      imageCover: sejour.images?.[0] || '',
      published: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextSessionStart: null,
      // P1 FIX: Sessions réelles pour calcul durée dans StayCard
      sessions: sessions
        .filter(s => s.start_date && s.end_date)
        .map((s) => ({
          id: `${sejour.slug}__${s.start_date}__${s.end_date}`,
          stayId: sejour.slug,
          startDate: s.start_date,
          endDate: s.end_date,
          seatsLeft: -1, // gd_stay_sessions n'a pas seats_left — jamais bloquer
        })),

      // === CHAMPS PREMIUM (fallback null = le front utilise les champs legacy) ===
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

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header variant="minimal" />
      <HomeContent stays={staysData} viewMode="carousels" />
      <BottomNav />
    </div>
  );
}
