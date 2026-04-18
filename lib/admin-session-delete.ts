import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Shared DELETE logic for admin stay sessions.
 * Partagé entre :
 *   - DELETE /api/admin/stays/[id]/sessions/[sessionId]    (legacy conservé)
 *   - POST   /api/admin/stays/sessions/delete              (body-based, anti-SSRF préemptif)
 *
 * Comportement IDENTIQUE au DELETE legacy :
 *   - staySlug n'est PAS utilisé dans le filtre (legacy ne filtre que par id session).
 *   - Le body côté POST porte staySlug pour cohérence UI mais le helper l'ignore.
 *   - Pas de validation UUID (legacy n'en avait pas — respect strict du comportement).
 *
 * Trigger DB `trg_log_session_delete` enregistre automatiquement la suppression
 * dans `gd_session_deletion_log` (cf. CLAUDE.md Règle #4 — traçabilité obligatoire).
 * Rien à faire côté app pour l'audit.
 *
 * Aucun NextRequest/NextResponse ici — la logique HTTP reste dans les routes.
 * Auth (requireAdmin) reste responsabilité de chaque route appelante.
 */
export async function runDeleteSession(
  sessionId: string
): Promise<{ success: true } | { error: string; status: number }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('gd_stay_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('runDeleteSession error:', err);
    return { error: 'Erreur serveur', status: 500 };
  }
}
