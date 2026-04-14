export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/admin/structures/[id]/audit-log
 *
 * Retourne les entrées d'audit pour une structure donnée.
 * Pagination via ?offset=0 (limit fixe 50).
 * Réservé aux admins.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Accès réservé aux administrateurs.' } },
      { status: 403 }
    );
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = getSupabaseAdmin();

  const { data: entries, error, count } = await supabase
    .from('gd_audit_log')
    .select('id, action, resource_type, resource_id, actor_type, metadata, created_at', { count: 'exact' })
    .eq('resource_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + 49);

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ entries: entries ?? [], total: count ?? 0 });
}
