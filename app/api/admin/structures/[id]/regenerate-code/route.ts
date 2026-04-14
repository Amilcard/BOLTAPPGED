export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';

/**
 * POST /api/admin/structures/[id]/regenerate-code
 *
 * Régénère le code CDS ou directeur d'une structure.
 * Body : { type: 'cds' | 'directeur' }
 * Réservé aux admins.
 */
export async function POST(
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
  const body = await req.json().catch(() => ({}));
  const codeType: string = body.type;

  if (!codeType || !['cds', 'directeur'].includes(codeType)) {
    return NextResponse.json(
      { error: { code: 'INVALID_TYPE', message: 'Type requis : "cds" ou "directeur".' } },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Vérifier que la structure existe
  const { data: structure } = await supabase
    .from('gd_structures')
    .select('id, name, code, code_directeur')
    .eq('id', id)
    .single();

  if (!structure) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Structure introuvable.' } },
      { status: 404 }
    );
  }

  // Générer le nouveau code via fonction SQL
  if (codeType === 'cds') {
    const { data: newCode } = await supabase.rpc('generate_structure_code');
    const { error } = await supabase
      .from('gd_structures')
      .update({
        code: newCode,
        code_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        code_generated_at: new Date().toISOString(),
        code_revoked_at: null,
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Erreur régénération.' } },
        { status: 500 }
      );
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: id,
      actorType: 'admin',
      actorId: auth.email,
      metadata: { type: 'regenerate_code_cds', old_code: structure.code, new_code: newCode },
    });

    return NextResponse.json({ success: true, type: 'cds', newCode, expiresInDays: 90 });
  }

  if (codeType === 'directeur') {
    const { data: newCode } = await supabase.rpc('generate_director_code');
    const { error } = await supabase
      .from('gd_structures')
      .update({
        code_directeur: newCode,
        code_directeur_expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        code_directeur_generated_at: new Date().toISOString(),
        code_directeur_revoked_at: null,
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Erreur régénération.' } },
        { status: 500 }
      );
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'inscription',
      resourceId: id,
      actorType: 'admin',
      actorId: auth.email,
      metadata: { type: 'regenerate_code_directeur', old_code: structure.code_directeur, new_code: newCode },
    });

    return NextResponse.json({ success: true, type: 'directeur', newCode, expiresInDays: 180 });
  }
}
