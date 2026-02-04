import { getSejours, supabaseGed, getAllStayThemes } from '@/lib/supabaseGed';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { HomeCarousels } from '@/components/home-carousels';
import type { Stay } from '@/lib/types';

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

  // Créer un map slug → {ageMin, ageMax}
  const agesMap = new Map<string, { ageMin: number; ageMax: number }>();
  for (const row of agesData) {
    const existing = agesMap.get(row.stay_slug);
    if (!existing) {
      agesMap.set(row.stay_slug, { ageMin: row.age_min, ageMax: row.age_max });
    } else {
      agesMap.set(row.stay_slug, {
        ageMin: Math.min(existing.ageMin, row.age_min),
        ageMax: Math.max(existing.ageMax, row.age_max)
      });
    }
  }

  // Mapper les données GED vers le type Stay attendu
  const staysData: Stay[] = sejoursGed.map(sejour => {
    const ages = agesMap.get(sejour.slug) || { ageMin: 6, ageMax: 17 };
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
      ageMin: ages.ageMin,
      ageMax: ages.ageMax,
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
      <SejoursContent stays={staysData} />
      <BottomNav />
    </div>
  );
}
