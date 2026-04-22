import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit-log';
import { UUID_RE } from '@/lib/validators';
import { assertUpdatedSingle } from '@/lib/supabase-guards';

/**
 * Shared DELETE logic for admin inscriptions (soft delete).
 * Partagé entre :
 *   - DELETE /api/admin/inscriptions (id in body, URL littérale — anti-SSRF)
 *   - DELETE /api/admin/inscriptions/[id] (legacy, conservé)
 *
 * Comportement identique à l'ancien DELETE [id]/route.ts : soft delete + audit.
 */
export async function performInscriptionDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  id: string,
  authEmail: string
): Promise<NextResponse> {
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: { code: 'INVALID_ID', message: 'ID invalide.' } },
      { status: 400 }
    );
  }
  try {
    // UPDATE d'abord — si deja soft-deleted ou absente, .single() renvoie PGRST116
    // auditLog vient APRES la persistance pour eviter un log fantome (Prelude [4]).
    const { data, error } = await supabase
      .from('gd_inscriptions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single();
    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Inscription introuvable ou deja supprimee.' } },
          { status: 404 }
        );
      }
      throw error;
    }
    assertUpdatedSingle(data, 'admin_delete_inscription');

    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'inscription',
      resourceId: id,
      actorType: 'admin',
      actorId: authEmail,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('performInscriptionDelete error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
