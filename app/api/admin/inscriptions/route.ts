export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { enrichInscriptions, type InscriptionRaw } from '@/lib/inscription-enrichment';
/**
 * GET /api/admin/inscriptions
 * Liste les inscriptions de production (structures is_test=false, non supprimées).
 * Filtre via gd_structures!inner pour exclure les données test.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireEditor(req);
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Non autorisé' } },
        { status: 401 }
      );
    }

    // Paramètres optionnels de filtrage
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const structureId = searchParams.get('structure_id');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('gd_inscriptions')
      .select('*, gd_dossier_enfant(bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, ged_sent_at), gd_stays!fk_inscriptions_stay(marketing_title, title), gd_structures!inner(is_test)', { count: 'exact' })
      .eq('gd_structures.is_test', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
    }

    if (structureId) {
      query = query.eq('structure_id', structureId);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('GET /api/admin/inscriptions Supabase error:', error);
      throw error;
    }

    return NextResponse.json({ data: enrichInscriptions((data || []) as InscriptionRaw[]), total: count ?? 0, page, limit });
  } catch (error) {
    console.error('GET /api/admin/inscriptions error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
