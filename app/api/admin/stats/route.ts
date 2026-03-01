export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/admin/stats
 * Statistiques depuis Supabase (source de vérité).
 * - Séjours publiés depuis gd_stays
 * - Sessions depuis gd_stay_sessions
 * - Inscriptions depuis gd_inscriptions
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const auth = requireEditor(req);
    if (!auth) return NextResponse.json({ error: { code: 'unauthorized', message: 'Non autorisé' } }, { status: 401 });

    const [staysRes, sessionsRes, inscriptionsRes, inscriptionsNewRes] = await Promise.all([
      supabase.from('gd_stays').select('id', { count: 'exact', head: true }).eq('published', true),
      supabase.from('gd_stay_sessions').select('id', { count: 'exact', head: true }),
      supabase.from('gd_inscriptions').select('id', { count: 'exact', head: true }),
      supabase.from('gd_inscriptions').select('id', { count: 'exact', head: true }).eq('status', 'en_attente'),
    ]);

    // Vérifier les erreurs
    for (const res of [staysRes, sessionsRes, inscriptionsRes, inscriptionsNewRes]) {
      if (res.error) {
        console.error('GET /api/admin/stats Supabase error:', res.error);
        throw res.error;
      }
    }

    return NextResponse.json({
      stays: staysRes.count ?? 0,
      sessions: sessionsRes.count ?? 0,
      bookings: inscriptionsRes.count ?? 0,       // Total inscriptions
      bookingsNew: inscriptionsNewRes.count ?? 0,  // En attente
    });
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
  }
}
