export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { runDeleteUser } from '@/lib/admin-users-mutate';

/**
 * POST /api/admin/users/delete
 * Variante body-based (URL littérale côté client + id dans body — anti-SSRF préemptif).
 * Cohérent avec commits bf4e8f4, 07261f2, c087698.
 *
 * Logique métier partagée avec DELETE /api/admin/users/[id] (legacy conservée)
 * via runDeleteUser (lib/admin-users-mutate.ts). Anti self-delete conservé.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id : '';
    const result = await runDeleteUser(id, auth.userId, auth.email);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/users/delete error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
