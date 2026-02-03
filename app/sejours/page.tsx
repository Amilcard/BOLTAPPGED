import { getSejours, supabaseGed } from '@/lib/supabaseGed';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { HomeContent } from '../home-content';
import type { Stay } from '@/lib/types';
import { Search, SlidersHorizontal } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SejoursPage() {
  // Récupérer séjours + âges depuis gd_stay_sessions
  const [sejoursGed, agesData] = await Promise.all([
    getSejours(),
    supabaseGed.from('gd_stay_sessions')
      .select('stay_slug, age_min, age_max')
      .then(({ data }) => data || [])
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
    return {
      id: sejour.slug,
      slug: sejour.slug,
      title: sejour.title || 'Sans titre',
      descriptionShort: sejour.accroche || '',
      programme: sejour.programme ? sejour.programme.split('\n').filter(Boolean) : [],
      geography: sejour.location_region || sejour.location_city || '',
      accommodation: sejour.centre_name || '',
      supervision: 'Équipe UFOVAL',
      durationDays: 7,
      period: 'Été 2026',
      ageMin: ages.ageMin,
      ageMax: ages.ageMax,
      themes: [sejour.ged_theme || 'PLEIN_AIR'],
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

      {/* Airbnb-style Search Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 flex items-center gap-3 px-6 py-3.5 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-shadow">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Rechercher une destination, une activité..."
                className="flex-1 text-sm text-gray-900 placeholder-gray-500 bg-transparent border-none outline-none focus:ring-0"
                disabled
              />
            </div>

            {/* Filtres Button */}
            <button
              className="flex items-center gap-2 px-5 py-3.5 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-700 hidden sm:inline">Filtres</span>
            </button>
          </div>
        </div>
      </div>

      <HomeContent stays={staysData} hideInternalSearch={true} />
      <BottomNav />
    </div>
  );
}
