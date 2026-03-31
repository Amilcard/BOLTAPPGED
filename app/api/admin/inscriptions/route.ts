export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabase } from '@/lib/supabase-server';
/**
 * GET /api/admin/inscriptions
 * Liste les inscriptions depuis Supabase gd_inscriptions (source de vérité).
 * Remplace l'ancien GET /api/admin/bookings qui lisait Prisma.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const auth = requireEditor(req);
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
    const parsedLimit = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;

    let query = supabase
      .from('gd_inscriptions')
      .select('*, gd_dossier_enfant(bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, documents_joints, ged_sent_at), gd_stays!fk_inscriptions_stay(marketing_title, title)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (structureId) {
      query = query.eq('structure_id', structureId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET /api/admin/inscriptions Supabase error:', error);
      throw error;
    }

    // Enrichir avec les infos de completude dossier + titre sejour
    interface InscriptionRaw {
      gd_dossier_enfant?: Array<{ bulletin_completed?: boolean; sanitaire_completed?: boolean; liaison_completed?: boolean; renseignements_completed?: boolean; documents_joints?: Array<{ type: string }> | null; ged_sent_at?: string | null }>;
      gd_stays?: { marketing_title?: string; title?: string };
      sejour_slug: string;
      [key: string]: unknown;
    }
    const enriched = (data || []).map((insc: InscriptionRaw) => {
      const dossier = insc.gd_dossier_enfant?.[0] ?? null;
      const docs = dossier && Array.isArray(dossier.documents_joints) ? dossier.documents_joints : [];
      const stay = insc.gd_stays;

      return {
        ...insc,
        gd_dossier_enfant: undefined,
        gd_stays: undefined,
        sejour_titre: stay?.marketing_title || stay?.title || insc.sejour_slug,
        ged_sent_at: dossier?.ged_sent_at ?? null,
        dossier_completude: dossier ? {
          bulletin: !!dossier.bulletin_completed,
          sanitaire: !!dossier.sanitaire_completed,
          liaison: !!dossier.liaison_completed,
          renseignements: !!dossier.renseignements_completed,
          pj_count: docs.length,
          pj_vaccins: docs.some((d: { type?: string }) => d.type === 'vaccins'),
        } : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('GET /api/admin/inscriptions error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
