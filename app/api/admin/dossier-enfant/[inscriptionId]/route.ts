export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabase } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';
/**
 * GET /api/admin/dossier-enfant/[inscriptionId]
 * Admin : lecture seule du dossier enfant d'une inscription.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inscriptionId: string }> }
) {
  try {
    const auth = await requireEditor(req);
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
      .select('id, inscription_id, bulletin_complement, fiche_sanitaire, fiche_liaison_jeune, fiche_renseignements, documents_joints, bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, renseignements_required, created_at, updated_at')
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

    // RGPD Art. 9 — tracer lecture dossier enfant par admin
    auditLog(supabase, {
      action: 'read',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      actorType: 'admin',
      actorId: auth.email,
    });

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
