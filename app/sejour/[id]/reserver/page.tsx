import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getSejourBySlug, getStaySessions, getDepartureCitiesFormatted, getSessionPricesFormatted, getSessionPrices } from '@/lib/supabaseGed';
import { BookingFlow } from '@/components/booking-flow';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { session?: string; ville?: string };
}

export default async function ReserverPage({ params, searchParams }: PageProps) {
  const stay = await getSejourBySlug(params.id);
  if (!stay) notFound();

  // Récupérer sessions + villes + prix + is_full UFOVAL (source de vérité)
  const [sessionsRaw, departureCities, enrichmentSessions, sessionPrices] = await Promise.all([
    getStaySessions(params.id),
    getDepartureCitiesFormatted(params.id),
    getSessionPricesFormatted(params.id),
    getSessionPrices(params.id), // is_full mis à jour par n8n UFOVAL toutes les 6h
  ]);

  // Index is_full par clé start_date|end_date pour lookup rapide
  const isFullMap = new Map<string, boolean>(
    sessionPrices.map((p: any) => [`${p.start_date}|${p.end_date}`, p.is_full === true])
  );

  // Filtrer sessions sans dates valides (guard null DB)
  const validSessions = sessionsRaw.filter((s: any) => s.start_date && s.end_date);

  // Map snake_case DB → camelCase frontend
  // IMPORTANT: l'ID = slug__start__end — identique au format de sejour/[id]/page.tsx
  const sessions = validSessions.map((s: any) => ({
    ...s,
    id: `${params.id}__${s.start_date}__${s.end_date}`,
    stayId: params.id,
    startDate: s.start_date,
    endDate: s.end_date,
    // is_full UFOVAL — source de vérité Supabase — 0 = complet, -1 = dispo
    seatsLeft: isFullMap.get(`${s.start_date}|${s.end_date}`) ? 0 : -1,
  }));

  // Enrichir stay avec les données attendues par BookingFlow
  const enrichedStay = {
    ...stay,
    // Champs Stay requis par BookingFlow
    id: stay.slug,
    title: stay.marketingTitle || stay.title || 'Séjour',
    descriptionShort: stay.punchline || stay.expertPitch || '',
    geography: stay.location_region || stay.location_city || '',
    accommodation: stay.centre_name || '',
    supervision: 'Équipe Groupe & Découverte',
    imageCover: Array.isArray(stay.images) ? (stay.images as string[])[0] || '' : '',
    images: Array.isArray(stay.images) ? (stay.images as string[]) : [],
    published: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    durationDays: undefined,
    period: undefined,
    themes: [],
    departureCities,
    enrichmentSessions,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50/30">
      {/* Header avec breadcrumb */}
      <div className="bg-white border-b border-primary-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <nav className="text-sm text-primary-500 mb-2 flex items-center gap-2">
            <Link href="/" className="hover:text-primary-700 transition-colors">
              Accueil
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link
              href={`/sejour/${params.id}`}
              className="hover:text-primary-700 transition-colors"
            >
              {stay.marketingTitle || 'Séjour'}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-medium">Réserver</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">
            Réserver {stay.marketingTitle || 'Séjour'}
          </h1>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-primary-100 overflow-hidden">
          <BookingFlow
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stay={enrichedStay as any}
            sessions={sessions}
            initialSessionId={searchParams.session}
            initialCity={searchParams.ville}
          />
        </div>
      </div>
    </div>
  );
}
