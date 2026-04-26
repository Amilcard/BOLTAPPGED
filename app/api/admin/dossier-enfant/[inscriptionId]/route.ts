export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';
import { REQUIS_TO_JOINT, DOC_OPT_LABELS } from '@/lib/dossier-shared';
import { captureServerException } from '@/lib/sentry-capture';

type SignedBloc = { signature_image_url?: string | null } | null | undefined;

function hasSignature(bloc: SignedBloc): boolean {
  if (!bloc || typeof bloc !== 'object') return false;
  const v = (bloc as { signature_image_url?: unknown }).signature_image_url;
  return typeof v === 'string' && v.trim().length > 0;
}
/**
 * GET /api/admin/dossier-enfant/[inscriptionId]
 * Admin : lecture seule du dossier enfant d'une inscription.
 *
 * Inclut désormais :
 *   - ged_sent_at (date d'envoi à la GED)
 *   - signatures_status : drapeau par bloc (présence signature_image_url)
 *   - partial_docs_missing : PJ optionnelles requises non uploadées
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
    const supabase = getSupabaseAdmin();

    const { data: dossier, error: err } = await supabase
      .from('gd_dossier_enfant')
      .select('id, inscription_id, bulletin_complement, fiche_sanitaire, fiche_liaison_jeune, fiche_renseignements, documents_joints, bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, renseignements_required, ged_sent_at, created_at, updated_at')
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
        ged_sent_at: null,
        signatures_status: {
          bulletin: false,
          sanitaire: false,
          liaison: false,
          renseignements: false,
        },
        partial_docs_missing: [],
      });
    }

    // RGPD Art. 9 — tracer lecture dossier enfant par admin
    await auditLog(supabase, {
      action: 'read',
      resourceType: 'dossier_enfant',
      resourceId: inscriptionId,
      actorType: 'admin',
      actorId: auth.email,
    });

    // Drapeau signature présente par bloc (pour vue admin "1 coup d'œil")
    const signatures_status = {
      bulletin: hasSignature(dossier.bulletin_complement as SignedBloc),
      sanitaire: hasSignature(dossier.fiche_sanitaire as SignedBloc),
      liaison: hasSignature(dossier.fiche_liaison_jeune as SignedBloc),
      renseignements: hasSignature(dossier.fiche_renseignements as SignedBloc),
    };

    // Calcul des PJ optionnelles manquantes (mêmes règles que la route submit)
    let partial_docs_missing: Array<{ key: string; label: string }> = [];
    try {
      const { data: insc } = await supabase
        .from('gd_inscriptions')
        .select('sejour_slug')
        .eq('id', inscriptionId)
        .single();
      if (insc?.sejour_slug) {
        const { data: stay } = await supabase
          .from('gd_stays')
          .select('documents_requis')
          .eq('slug', insc.sejour_slug)
          .single();
        const docsRequis = Array.isArray((stay as { documents_requis?: unknown[] } | null)?.documents_requis)
          ? ((stay as { documents_requis: unknown[] }).documents_requis as string[])
          : [];
        const uploadedTypes = new Set(
          (Array.isArray(dossier.documents_joints)
            ? (dossier.documents_joints as Array<{ type?: string }>)
            : []
          )
            .map(d => d?.type)
            .filter((t): t is string => typeof t === 'string')
        );
        partial_docs_missing = docsRequis
          .filter(k => REQUIS_TO_JOINT[k])
          .filter(k => !uploadedTypes.has(REQUIS_TO_JOINT[k]))
          .map(k => ({ key: k, label: DOC_OPT_LABELS[k] || k }));
      }
    } catch (calcErr) {
      // Calcul non-bloquant — on n'empêche pas la lecture du dossier
      console.error('Admin GET dossier-enfant partial_docs calc error:', calcErr);
    }

    return NextResponse.json({
      exists: true,
      ...dossier,
      signatures_status,
      partial_docs_missing,
    });
  } catch (error) {
    captureServerException(error, { domain: 'audit', operation: 'admin_dossier_get' });
    console.error('Admin GET /api/admin/dossier-enfant error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
