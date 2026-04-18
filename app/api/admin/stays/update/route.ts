export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireEditor } from '@/lib/auth-middleware';
import { runUpdateStay } from '@/lib/admin-stays-mutate';

/**
 * PATCH /api/admin/stays/update
 * Variante body-based (URL littérale côté client + slug dans body — anti-SSRF préemptif).
 * Cohérent avec commits bf4e8f4, 07261f2, c087698.
 *
 * Logique métier partagée avec PUT /api/admin/stays/[id] (legacy conservée)
 * via runUpdateStay (lib/admin-stays-mutate.ts).
 *
 * Auth : requireEditor (ADMIN + EDITOR). Cohérent avec PUT legacy.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireEditor(req);
    if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const slug = typeof (body as { slug?: unknown }).slug === 'string' ? (body as { slug: string }).slug : '';
    const { slug: _unused, ...fields } = body as Record<string, unknown>;
    void _unused;
    const result = await runUpdateStay(slug, fields);
    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('PATCH /api/admin/stays/update error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
