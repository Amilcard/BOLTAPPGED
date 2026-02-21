import { getSejours, supabaseGed, getAllStayThemes, getMinPricesBySlug } from '@/lib/supabaseGed';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { HomeContent } from '@/app/home-content';
import type { Stay } from '@/lib/types';
import { getStayAgeData, getStayDurationDays, getStayPeriod } from '@/lib/age-utils';

export const dynamic = 'force-dynamic';

export default async function RecherchePage() {
  // Récupérer séjours + âges + thèmes depuis Supabase
  const [sejoursGed, agesData, themesMap, pricesMap] = await Promise.all([
    getSejours(),
    supabaseGed.from('gd_stay_sessions')
      .select('stay_slug, age_min, age_max, start_date, end_date')
      .then(({ data }: { data: Array<{ stay_slug: string; age_min: number; age_max: number; start_date: string; end_date: string }> | null }) => data || []),
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

    // Sprint 1+2: Calcul unifié âges + durée + période via helpers centralisés
    const { ageMin, ageMax, ageRangesDisplay } = getStayAgeData(sessions);
    const durationDays = getStayDurationDays(sessions, 7);

    // Récupérer les thèmes depuis gd_stay_themes
    const stayThemes = themesMap[sejour.slug] || [];

    return {
      id: sejour.slug,
      slug: sejour.slug,
      // NEUTRALISÉ: Les champs legacy UFOVAL ne sont plus transmis au front
      title: sejour.marketing_title || 'Séjour', // CityCrunch uniquement
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
      themes: stayThemes,
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
      // === CHAMPS PREMIUM MARKETING ===
      marketingTitle: sejour.marketing_title || undefined,
      punchline: sejour.punchline || undefined,
      expertPitch: sejour.expert_pitch || undefined,
      emotionTag: sejour.emotion_tag || undefined,
      carouselGroup: sejour.carousel_group || undefined,
      spotLabel: sejour.spot_label || undefined,
      standingLabel: sejour.standing_label || undefined,
      expertiseLabel: sejour.expertise_label || undefined,
      intensityLabel: sejour.intensity_label || undefined,
      priceIncludesFeatures: sejour.price_includes_features || undefined,
    };
  });

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header variant="minimal" />
      {/* Mode Grid pour la page Recherche */}
      <HomeContent stays={staysData} viewMode="grid" />
      <BottomNav />
    </div>
  );
}
