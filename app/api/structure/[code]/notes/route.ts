export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionOwnership } from '@/lib/resource-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';

/**
 * GET /api/structure/[code]/notes
 * Liste les notes par enfant. Tous les rôles sauf secrétariat.
 * Éducateur : lecture seule.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
 try {
  const rateLimited = await structureRateLimitGuard(_req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const guard = await requireStructureRole(_req, code, { excludeRoles: ['secretariat'] });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  let query = supabase
    .from('gd_notes')
    .select('id, inscription_id, content, created_by, created_at')
    .eq('structure_id', structureId)
    .order('created_at', { ascending: false });

  // Éducateur : lecture limitée à ses propres inscriptions (RGPD Art. 9)
  if (resolved.role === 'educateur' && resolved.email) {
    const { data: myInscriptions } = await supabase
      .from('gd_inscriptions')
      .select('id')
      .eq('structure_id', structureId)
      .eq('referent_email', resolved.email);

    const ids = (myInscriptions ?? []).map((i: { id: string }) => i.id);
    if (ids.length === 0) {
      return NextResponse.json({ notes: [] });
    }
    query = query.in('inscription_id', ids);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[notes GET] error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'read',
    resourceType: 'inscription',
    resourceId: structureId,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'notes_read', role: resolved.role, count: data?.length ?? 0 },
  });

  return NextResponse.json({ notes: data ?? [] });
 } catch (err) {
  console.error('GET /api/structure/[code]/notes error:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
 }
}

/**
 * POST /api/structure/[code]/notes
 * Ajouter une note sur un enfant. Direction et CDS uniquement.
 * Non éditable après envoi (traçabilité RGPD).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
 try {
  const rateLimited = await structureRateLimitGuard(req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const guard = await requireStructureRole(req, code, {
    allowRoles: ['direction', 'cds', 'cds_delegated'],
    forbiddenMessage: 'Accès réservé à la direction et au CDS.',
  });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const { inscription_id, content } = body;

  if (!inscription_id || typeof inscription_id !== 'string') {
    return NextResponse.json({ error: 'inscription_id requis (note liée à un enfant).' }, { status: 400 });
  }
  if (!content || typeof content !== 'string' || content.trim().length < 5) {
    return NextResponse.json({ error: 'Contenu requis (min 5 caractères).' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  // Scope ownership : éducateur/secrétariat limité à ses propres inscriptions.
  const ownership = await requireInscriptionOwnership({
    supabase,
    resolved,
    inscriptionId: inscription_id,
    structureId,
  });
  if (!ownership.ok) return ownership.response;

  const { data: note, error: insertError } = await supabase
    .from('gd_notes')
    .insert({
      structure_id: structureId,
      inscription_id,
      content: content.trim(),
      created_by: resolved.email || 'unknown',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[notes POST] error:', insertError.message);
    return NextResponse.json({ error: 'Erreur création note.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'inscription',
    resourceId: note.id,
    inscriptionId: inscription_id as string,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'note_created', role: resolved.role },
  });

  return NextResponse.json({ ok: true, id: note.id }, { status: 201 });
 } catch (err) {
  console.error('POST /api/structure/[code]/notes error:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
 }
}
