// ROUTE DE DEBUG — À SUPPRIMER APRÈS TESTS
// Tester via: /api/debug-is-full?slug=dh-experience-11-13-ans
import { NextResponse } from 'next/server';
import { supabaseGed } from '@/lib/supabaseGed';

export const dynamic = 'force-dynamic';

// Typage strict — gd_session_prices (granularité session/ville)
interface SessionPrice {
  start_date: string;
  end_date: string;
  city_departure: string;
  is_full: boolean | null;
}

// Typage strict — gd_stays (flag global séjour)
interface StayDebug {
  slug: string;
  is_full: boolean | null;
  marketing_title: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || 'dh-experience-11-13-ans';

  // Query 1 : sessions granulaires (is_full au niveau session/ville)
  const { data: prices } = await supabaseGed
    .from('gd_session_prices')
    .select('start_date, end_date, city_departure, is_full')
    .eq('stay_slug', slug)
    .eq('city_departure', 'sans_transport')
    .order('start_date') as { data: SessionPrice[] | null };

  // Query 2 : flag global du séjour (agrégé par n8n PHASE3)
  const { data: stay } = await supabaseGed
    .from('gd_stays')
    .select('slug, is_full, marketing_title')
    .eq('slug', slug)
    .single() as { data: StayDebug | null };

  return NextResponse.json({
    slug,
    stay,
    sessions: prices,
    summary: {
      total: prices?.length || 0,
      sessions_full: prices?.filter(p => p.is_full === true).length || 0,
      stay_is_full: stay?.is_full ?? false,
    }
  });
}
