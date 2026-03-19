export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth-middleware';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/admin/session-prices?stay_slug=xxx
 * Retourne les tarifs de sessions pour un séjour donné
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const staySlug = request.nextUrl.searchParams.get('stay_slug');
    if (!staySlug) {
      return NextResponse.json({ error: 'stay_slug requis' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('gd_session_prices')
      .select('stay_slug, start_date, end_date, city_departure, base_price_eur, transport_surcharge_ged, price_ged_total')
      .eq('stay_slug', staySlug)
      .order('start_date');

    if (error) throw error;

    return NextResponse.json({ sessions: data || [] });
  } catch (err: any) {
    console.error('Error in GET /api/admin/session-prices:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
