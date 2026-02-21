// ROUTE DE DEBUG — À SUPPRIMER APRÈS TESTS
// Tester via: /api/debug-is-full?slug=dh-experience-11-13-ans
import { NextResponse } from 'next/server';
import { supabaseGed } from '@/lib/supabaseGed';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || 'dh-experience-11-13-ans';

  const { data: prices } = await supabaseGed
    .from('gd_session_prices')
    .select('start_date, end_date, city_departure, is_full')
    .eq('stay_slug', slug)
    .eq('city_departure', 'sans_transport')
    .order('start_date');

  const { data: stay } = await supabaseGed
    .from('gd_stays')
    .select('slug, is_full, marketing_title')
    .eq('slug', slug)
    .single();

  return NextResponse.json({
    slug,
    stay,
    sessions: prices,
    summary: {
      total: prices?.length || 0,
      full: prices?.filter(p => p.is_full === true).length || 0,
    }
  });
}
