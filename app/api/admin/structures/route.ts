export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyAuth } from '@/lib/auth-middleware';

/**
 * GET /api/admin/structures
 *
 * Liste toutes les structures avec compteur d'inscriptions rattachées.
 * Paramètres optionnels : ?search=xxx&type=xxx&status=active
 *
 * Retourne aussi les inscriptions orphelines (structure_pending_name sans structure_id).
 *
 * Accès : verifyAuth — tout membre GED (ADMIN, EDITOR, VIEWER).
 */
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() || '';
    const type = url.searchParams.get('type')?.trim() || '';
    const status = url.searchParams.get('status')?.trim() || 'active';

    // 1. Récupérer les structures
    let query = supabase
      .from('gd_structures')
      .select('id, name, code, city, postal_code, type, email, status, address, created_at');

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,code.ilike.%${search}%`);
    }

    const { data: structures, error: structErr } = await query.order('created_at', { ascending: false });

    if (structErr) {
      console.error('[admin/structures] query error:', structErr);
      throw structErr;
    }

    // 2. Compter les inscriptions par structure_id
    const structIds = (structures || []).map((s: { id: string }) => s.id);
    let inscriptionCounts: Record<string, number> = {};

    if (structIds.length > 0) {
      const { data: countRows } = await supabase
        .from('gd_inscriptions')
        .select('structure_id')
        .in('structure_id', structIds);

      if (countRows) {
        for (const row of countRows as { structure_id: string }[]) {
          inscriptionCounts[row.structure_id] = (inscriptionCounts[row.structure_id] || 0) + 1;
        }
      }
    }

    // 3. Enrichir les structures avec le compteur
    const result = (structures || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      city: s.city,
      postalCode: s.postal_code,
      type: s.type,
      email: s.email,
      status: s.status,
      address: s.address,
      createdAt: s.created_at,
      inscriptionCount: inscriptionCounts[s.id as string] || 0,
    }));

    // 4. Inscriptions orphelines (structure_pending_name sans structure_id)
    const { data: orphanRows, error: orphErr } = await supabase
      .from('gd_inscriptions')
      .select('id, dossier_ref, structure_pending_name, structure_postal_code, structure_city, structure_type, referent_nom, referent_email, jeune_prenom, created_at')
      .is('structure_id', null)
      .not('structure_pending_name', 'is', null)
      .order('created_at', { ascending: false });

    if (orphErr) {
      console.error('[admin/structures] orphan query error:', orphErr);
    }

    const orphans = (orphanRows || []).map((o: Record<string, unknown>) => ({
      id: o.id,
      dossierRef: o.dossier_ref,
      structurePendingName: o.structure_pending_name,
      postalCode: o.structure_postal_code,
      city: o.structure_city,
      type: o.structure_type,
      referentNom: o.referent_nom,
      referentEmail: o.referent_email,
      jeunePrenom: o.jeune_prenom,
      createdAt: o.created_at,
    }));

    return NextResponse.json({
      structures: result,
      orphans,
      total: result.length,
      orphanCount: orphans.length,
    });
  } catch (err) {
    console.error('[admin/structures] GET error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
