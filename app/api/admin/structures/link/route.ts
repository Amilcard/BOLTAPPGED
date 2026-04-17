export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireEditor } from '@/lib/auth-middleware';
import { auditLog } from '@/lib/audit-log';
import { UUID_RE } from '@/lib/validators';

/**
 * PATCH /api/admin/structures/link
 *
 * Rattachement manuel d'une inscription orpheline à une structure existante.
 * Body : { inscriptionId: string, structureId: string }
 *
 * L'admin ou éditeur voit une inscription avec structure_pending_name mais sans structure_id
 * et la rattache manuellement à la bonne structure.
 *
 * Sécurité : EDITOR ou ADMIN (action qui modifie des données).
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireEditor(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { inscriptionId, structureId } = body;

    if (!inscriptionId || !structureId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMS', message: 'inscriptionId et structureId requis.' } },
        { status: 400 }
      );
    }

    if (!UUID_RE.test(inscriptionId) || !UUID_RE.test(structureId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'Format UUID invalide.' } },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Vérifier que la structure cible existe
    const { data: structure } = await supabase
      .from('gd_structures')
      .select('id, name')
      .eq('id', structureId)
      .single();

    if (!structure) {
      return NextResponse.json(
        { error: { code: 'STRUCTURE_NOT_FOUND', message: 'Structure introuvable.' } },
        { status: 404 }
      );
    }

    // Vérifier que l'inscription existe et est bien orpheline
    const { data: inscriptionRaw } = await supabase
      .from('gd_inscriptions')
      .select('id, structure_id, structure_pending_name')
      .eq('id', inscriptionId)
      .single();

    const inscription = inscriptionRaw as { id: string; structure_id: string | null; structure_pending_name: string | null } | null;

    if (!inscription) {
      return NextResponse.json(
        { error: { code: 'INSCRIPTION_NOT_FOUND', message: 'Inscription introuvable.' } },
        { status: 404 }
      );
    }

    if (inscription.structure_id) {
      return NextResponse.json(
        { error: { code: 'ALREADY_LINKED', message: 'Cette inscription est déjà rattachée à une structure.' } },
        { status: 409 }
      );
    }

    // Rattacher
    const { error: updateErr } = await supabase
      .from('gd_inscriptions')
      .update({
        structure_id: structureId,
        structure_pending_name: null,
      })
      .eq('id', inscriptionId);

    if (updateErr) {
      console.error('[admin/structures/link] update error:', updateErr);
      throw updateErr;
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: inscriptionId,
      actorType: 'admin',
      actorId: auth.email,
      metadata: {
        type: 'structure_link',
        structure_id: structureId,
        structure_name: (structure as { name: string }).name,
        previous_pending_name: inscription.structure_pending_name,
      },
    });

    return NextResponse.json({
      ok: true,
      inscriptionId,
      structureId,
      structureName: (structure as { name: string }).name,
    });
  } catch (err) {
    console.error('[admin/structures/link] error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
