export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

/**
 * GET /api/structure/[code]
 *
 * Accès public — le code 6 caractères fait office de token (même principe que /suivi/[token]).
 * Retourne les infos de la structure + toutes les inscriptions rattachées.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || !/^[A-Z0-9]{6}$/i.test(code)) {
    return NextResponse.json(
      { error: { code: 'INVALID_CODE', message: 'Format de code invalide.' } },
      { status: 400 }
    );
  }

  const codeNorm = code.toUpperCase();
  const supabase = getSupabase();

  // 1. Récupérer la structure
  const { data: structure, error: structErr } = await supabase
    .from('gd_structures')
    .select('id, name, city, postal_code, type, email')
    .eq('code', codeNorm)
    .eq('status', 'active')
    .single();

  if (structErr || !structure) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Code structure invalide ou structure inactive.' } },
      { status: 404 }
    );
  }

  // 2. Récupérer les inscriptions rattachées
  const { data: inscriptions, error: inscErr } = await supabase
    .from('gd_inscriptions')
    .select(
      '*, gd_dossier_enfant(bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, documents_joints, ged_sent_at), gd_stays!fk_inscriptions_stay(marketing_title, title)'
    )
    .eq('structure_id', structure.id)
    .order('created_at', { ascending: false });

  if (inscErr) {
    console.error('[api/structure/[code]] inscriptions error:', inscErr);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }

  // 3. Enrichir (même logique que /api/admin/inscriptions)
  const enriched = (inscriptions || []).map((insc: Record<string, unknown>) => {
    const dossierArr = insc.gd_dossier_enfant as Record<string, unknown>[] | null;
    const dossier = Array.isArray(dossierArr) ? dossierArr[0] : null;
    const docs = dossier && Array.isArray(dossier.documents_joints) ? dossier.documents_joints as Record<string, unknown>[] : [];
    const stay = insc.gd_stays as Record<string, unknown> | null;

    return {
      ...insc,
      gd_dossier_enfant: undefined,
      gd_stays: undefined,
      sejour_titre: (stay?.marketing_title || stay?.title || insc.sejour_slug) as string,
      ged_sent_at: (dossier?.ged_sent_at as string) ?? null,
      dossier_completude: dossier
        ? {
            bulletin: !!dossier.bulletin_completed,
            sanitaire: !!dossier.sanitaire_completed,
            liaison: !!dossier.liaison_completed,
            renseignements: !!dossier.renseignements_completed,
            pj_count: docs.length,
          }
        : null,
    };
  });

  return NextResponse.json({
    structure: {
      id: structure.id,
      name: structure.name,
      city: structure.city,
      postalCode: structure.postal_code,
      type: structure.type,
      email: structure.email,
      code: codeNorm,
    },
    inscriptions: enriched,
  });
}
