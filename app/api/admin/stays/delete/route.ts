export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { runDeleteStay } from '@/lib/admin-stays-mutate';

/**
 * POST /api/admin/stays/delete
 * Variante body-based (URL littérale côté client + slug dans body — anti-SSRF préemptif).
 * Cohérent avec commits bf4e8f4, 07261f2, c087698.
 *
 * Logique métier partagée avec DELETE /api/admin/stays/[id] (legacy conservée)
 * via runDeleteStay (lib/admin-stays-mutate.ts). FK 23503 gérée uniformément.
 *
 * Auth : requireAdmin (DELETE réservé ADMIN). Cohérent avec DELETE legacy.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const slug = typeof (body as { slug?: unknown }).slug === 'string' ? (body as { slug: string }).slug : '';
    const result = await runDeleteStay(slug);
    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/stays/delete error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
