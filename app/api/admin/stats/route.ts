export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabase } from '@/lib/supabase-server';


/**
 * GET /api/admin/stats
 * Statistiques enrichies depuis Supabase (source de vérité).
 * - Compteurs de base (séjours, sessions, inscriptions)
 * - Répartition par statut
 * - Inscriptions des 7 derniers jours
 * - Top 5 séjours les plus demandés
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const auth = requireEditor(req);
    if (!auth) return NextResponse.json({ error: { code: 'unauthorized', message: 'Non autorisé' } }, { status: 401 });

    // Date il y a 7 jours (ISO)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      staysRes,
      sessionsRes,
      inscriptionsRes,
      inscriptionsNewRes,
      inscriptionsValidees,
      inscriptionsRefusees,
      inscriptionsAnnulees,
      recentRes,
      topSejoursRes,
    ] = await Promise.all([
      supabase.from('gd_stays').select('*', { count: 'exact', head: true }).eq('published', true),
      supabase.from('gd_stay_sessions').select('*', { count: 'exact', head: true }),
      supabase.from('gd_inscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('gd_inscriptions').select('*', { count: 'exact', head: true }).eq('status', 'en_attente'),
      supabase.from('gd_inscriptions').select('*', { count: 'exact', head: true }).eq('status', 'validee'),
      supabase.from('gd_inscriptions').select('*', { count: 'exact', head: true }).eq('status', 'refusee'),
      supabase.from('gd_inscriptions').select('*', { count: 'exact', head: true }).eq('status', 'annulee'),
      // Inscriptions des 7 derniers jours avec date pour graph
      supabase.from('gd_inscriptions').select('created_at').gte('created_at', sevenDaysAgo).order('created_at', { ascending: true }),
      // Top séjours (on récupère tous les sejour_slug et on compte côté serveur)
      supabase.from('gd_inscriptions').select('sejour_slug'),
    ]);

    // Vérifier les erreurs critiques (compteurs)
    for (const res of [staysRes, sessionsRes, inscriptionsRes, inscriptionsNewRes]) {
      if (res.error) {
        console.error('GET /api/admin/stats Supabase error:', res.error);
        throw res.error;
      }
    }

    // Répartition par statut
    const byStatus = {
      en_attente: inscriptionsNewRes.count ?? 0,
      validee: inscriptionsValidees.count ?? 0,
      refusee: inscriptionsRefusees.count ?? 0,
      annulee: inscriptionsAnnulees.count ?? 0,
    };

    // Inscriptions par jour (7 derniers jours)
    const recentByDay: Record<string, number> = {};
    // Pré-remplir les 7 jours
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      recentByDay[key] = 0;
    }
    if (recentRes.data) {
      for (const row of recentRes.data as unknown as { created_at: string }[]) {
        const day = row.created_at?.slice(0, 10);
        if (day && day in recentByDay) {
          recentByDay[day]++;
        }
      }
    }
    const recentDays = Object.entries(recentByDay).map(([date, count]) => ({ date, count }));

    // Top 5 séjours
    const slugCounts: Record<string, number> = {};
    if (topSejoursRes.data) {
      for (const row of topSejoursRes.data as unknown as { sejour_slug: string }[]) {
        const slug = row.sejour_slug;
        if (slug) slugCounts[slug] = (slugCounts[slug] || 0) + 1;
      }
    }
    const topSejours = Object.entries(slugCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([slug, count]) => ({ slug, label: slug.replace(/-/g, ' '), count }));

    return NextResponse.json({
      stays: staysRes.count ?? 0,
      sessions: sessionsRes.count ?? 0,
      bookings: inscriptionsRes.count ?? 0,
      bookingsNew: inscriptionsNewRes.count ?? 0,
      byStatus,
      recentDays,
      topSejours,
    });
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
  }
}
