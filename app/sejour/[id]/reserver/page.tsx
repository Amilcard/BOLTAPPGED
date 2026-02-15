import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getSejourBySlug, getStaySessions } from '@/lib/supabaseGed';
import { BookingFlow } from '@/components/booking-flow';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { session?: string; ville?: string };
}

export default async function ReserverPage({ params, searchParams }: PageProps) {
  const stay = await getSejourBySlug(params.id);
  if (!stay) notFound();

  const sessionsRaw = await getStaySessions(params.id);

  // Map snake_case DB → camelCase frontend
  const sessions = sessionsRaw.map((s: any) => ({
    ...s,
    startDate: s.start_date,
    endDate: s.end_date,
    seatsLeft: s.seats_left,
  }));

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
              {stay.marketingTitle || stay.title}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-medium">Réserver</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">
            Réserver {stay.marketingTitle || stay.title}
          </h1>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-primary-100 overflow-hidden">
          <BookingFlow
            stay={stay}
            sessions={sessions}
            initialSessionId={searchParams.session}
            initialCity={searchParams.ville}
          />
        </div>
      </div>
    </div>
  );
}
