import { getSejours, supabaseGed, getAllStayThemes } from '@/lib/supabaseGed';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { HomeContent } from '@/app/home-content';
import type { Stay } from '@/lib/types';
import { getUniqueAgeRanges, formatAgeRangesDisplay, calculateGlobalAgeRange } from '@/lib/age-utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Récupérer séjours + âges + thèmes depuis Supabase
  const [sejoursGed, agesData, themesMap] = await Promise.all([
    getSejours(),
    supabaseGed.from('gd_stay_sessions')
      .select('stay_slug, age_min, age_max')
      .then(({ data }) => data || []),
    getAllStayThemes()
  ]);

  // Créer un map slug → sessions pour calcul unifié des âges
  const sessionsMap = new Map<string, Array<{ age_min: number; age_max: number }>>();
  for (const row of agesData) {
    if (!sessionsMap.has(row.stay_slug)) {
      sessionsMap.set(row.stay_slug, []);
    }
    sessionsMap.get(row.stay_slug)!.push({ age_min: row.age_min, age_max: row.age_max });
  }

  // Mapper les données GED vers le type Stay attendu
  const staysData: Stay[] = sejoursGed.map(sejour => {
    const sessions = sessionsMap.get(sejour.slug) || [];
    
    // Calculer range global (pour filtres/fallback)
    const { ageMin, ageMax } = calculateGlobalAgeRange(sessions);
    
    // Calculer affichage détaillé (tranches uniques)
    const ranges = getUniqueAgeRanges(sessions);
    const ageRangesDisplay = ranges.length > 0 ? formatAgeRangesDisplay(ranges) : undefined;
    
    // Récupérer les thèmes depuis gd_stay_themes (multi-thèmes)
    const stayThemes = themesMap[sejour.slug] || [];
    
    return {
      id: sejour.slug,
      slug: sejour.slug,
      title: sejour.title || 'Sans titre',
      descriptionShort: sejour.accroche || '',
      // CityCrunch: titres/descriptions Pro/Kids (optionnel, fallback côté client)
      titlePro: sejour.title_pro || undefined,
      titleKids: sejour.title_kids || undefined,
      descriptionPro: sejour.description_pro || undefined,
      descriptionKids: sejour.description_kids || undefined,
      programme: sejour.programme ? sejour.programme.split('\n').filter(Boolean) : [],
      geography: sejour.location_region || sejour.location_city || '',
      accommodation: sejour.centre_name || '',
      supervision: 'Équipe Groupe & Découverte',
      durationDays: 7,
      period: 'été',
      ageMin,
      ageMax,
      ageRangesDisplay, // NEW: Detailed age ranges for display
      themes: stayThemes, // Multi-thèmes depuis gd_stay_themes
      imageCover: sejour.images?.[0] || '',
      published: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextSessionStart: null,
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
