export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/auth-middleware';
import { auditLog } from '@/lib/audit-log';

/**
 * POST /api/admin/structures/merge
 *
 * Fusionne une structure source dans une structure cible.
 * Body : { sourceId: string, targetId: string }
 *
 * Opérations (via RPC transactionnelle) :
 *  1. UPDATE gd_inscriptions SET structure_id = targetId WHERE structure_id = sourceId
 *  2. UPDATE gd_souhaits SET structure_id = targetId WHERE structure_id = sourceId
 *  3. DELETE FROM gd_structures WHERE id = sourceId
 *
 * Sécurité : ADMIN uniquement.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'sourceId et targetId requis.' } },
        { status: 400 }
      );
    }

    if (sourceId === targetId) {
      return NextResponse.json(
        { error: { code: 'SAME_ID', message: 'Impossible de fusionner une structure avec elle-même.' } },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sourceId) || !uuidRegex.test(targetId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'Format UUID invalide.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Vérifier que les deux structures existent
    const { data: source } = await supabase
      .from('gd_structures')
      .select('id, name')
      .eq('id', sourceId)
      .single();

    const { data: target } = await supabase
      .from('gd_structures')
      .select('id, name')
      .eq('id', targetId)
      .single();

    if (!source) {
      return NextResponse.json(
        { error: { code: 'SOURCE_NOT_FOUND', message: 'Structure source introuvable.' } },
        { status: 404 }
      );
    }
    if (!target) {
      return NextResponse.json(
        { error: { code: 'TARGET_NOT_FOUND', message: 'Structure cible introuvable.' } },
        { status: 404 }
      );
    }

    // Transaction via RPC — exécuter les 3 opérations
    // Supabase JS ne supporte pas les transactions natives, on utilise rpc avec du SQL raw
    const { error: rpcErr } = await supabase.rpc('merge_structures', {
      p_source_id: sourceId,
      p_target_id: targetId,
    });

    if (rpcErr) {
      // Fallback si la fonction RPC n'existe pas encore : exécuter séquentiellement
      // (moins sûr mais fonctionnel — la RPC sera ajoutée en migration)
      console.warn('[admin/structures/merge] RPC not available, falling back to sequential:', rpcErr.message);

      // 1. Rebase inscriptions
      const { error: e1 } = await supabase
        .from('gd_inscriptions')
        .update({ structure_id: targetId })
        .eq('structure_id', sourceId);
      if (e1) throw e1;

      // 2. Rebase souhaits
      const { error: e2 } = await supabase
        .from('gd_souhaits')
        .update({ structure_id: targetId })
        .eq('structure_id', sourceId);
      if (e2) throw e2;

      // 3. Supprimer la source
      const { error: e3 } = await supabase
        .from('gd_structures')
        .delete()
        .eq('id', sourceId);
      if (e3) throw e3;
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: targetId,
      actorType: 'admin',
      actorId: auth.email,
      metadata: {
        type: 'structure_merge',
        source_id: sourceId,
        source_name: (source as { name: string }).name,
        target_name: (target as { name: string }).name,
      },
    });

    return NextResponse.json({
      ok: true,
      merged: {
        sourceId,
        sourceName: (source as { name: string }).name,
        targetId,
        targetName: (target as { name: string }).name,
      },
    });
  } catch (err) {
    console.error('[admin/structures/merge] error:', err);
    return NextResponse.json({ error: 'Erreur lors de la fusion.' }, { status: 500 });
  }
}
