export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { runUpdateUser } from '@/lib/admin-users-mutate';

/**
 * POST /api/admin/users/update
 * Variante body-based (URL littérale côté client + id dans body — anti-SSRF préemptif).
 * Cohérent avec commits bf4e8f4, 07261f2, c087698.
 *
 * Logique métier partagée avec PUT /api/admin/users/[id] (legacy conservée)
 * via runUpdateUser (lib/admin-users-mutate.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id : '';
    const { id: _unused, ...fields } = body as Record<string, unknown>;
    void _unused;
    const result = await runUpdateUser(id, fields as never, auth.email);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error('POST /api/admin/users/update error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
