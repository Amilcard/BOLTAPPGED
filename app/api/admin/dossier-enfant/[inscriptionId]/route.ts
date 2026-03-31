export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabase } from '@/lib/supabase-server';
/**
 * GET /api/admin/dossier-enfant/[inscriptionId]
 * Admin : lecture seule du dossier enfant d'une inscription.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const auth = requireEditor(req);
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Non autorisé' } },
        { status: 401 }
      );
    }

    const { inscriptionId } = await params;
    const supabase = getSupabase();

    const { data: dossier, error: err } = await supabase
      .from('gd_dossier_enfant')
      .select('*')
      .eq('inscription_id', inscriptionId)
      .maybeSingle();

    if (err) {
      console.error('Admin GET dossier-enfant error:', err);
      throw err;
    }

    if (!dossier) {
      return NextResponse.json({
        exists: false,
        bulletin_completed: false,
        sanitaire_completed: false,
        liaison_completed: false,
        renseignements_completed: false,
        bulletin_complement: {},
        fiche_sanitaire: {},
        fiche_liaison_jeune: {},
      });
    }

    return NextResponse.json({
      exists: true,
      ...dossier,
    });
  } catch (error) {
    console.error('Admin GET /api/admin/dossier-enfant error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
