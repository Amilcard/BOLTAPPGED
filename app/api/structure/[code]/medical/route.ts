export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { requireInscriptionOwnership } from '@/lib/resource-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';

/**
 * GET /api/structure/[code]/medical
 * Événements médicaux — Art. 9 RGPD.
 * - Éducateur : compteur uniquement
 * - CDS/Direction : détail complet
 * - Secrétariat : aucun accès
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

  // Éducateur : compteur uniquement, SCOPÉ à ses propres inscriptions (RGPD Art. 9)
  if (resolved.role === 'educateur' && resolved.email) {
    const { data: myInscriptions } = await supabase
      .from('gd_inscriptions')
      .select('id')
      .eq('structure_id', structureId)
      .eq('referent_email', resolved.email);

    const ids = (myInscriptions ?? []).map((i: { id: string }) => i.id);
    if (ids.length === 0) return NextResponse.json({ count: 0, detail: null });

    const { count, error } = await supabase
      .from('gd_medical_events')
      .select('id', { count: 'exact', head: true })
      .eq('structure_id', structureId)
      .in('inscription_id', ids);

    if (error) {
      console.error('[medical GET count] error:', error.message);
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0, detail: null });
  }

  // CDS/Direction : détail complet
  const { data, error } = await supabase
    .from('gd_medical_events')
    .select('id, inscription_id, event_type, description, created_by, created_at')
    .eq('structure_id', structureId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[medical GET] error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'read',
    resourceType: 'dossier_enfant',
    resourceId: structureId,
    actorType: 'staff',
    actorId: resolved.email || undefined,
    metadata: { type: 'medical_events_read', role: resolved.role, count: data?.length ?? 0 },
  });

  return NextResponse.json({ count: data?.length ?? 0, detail: data ?? [] });
 } catch (err) {
  console.error('GET /api/structure/[code]/medical error:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
 }
}

/**
 * POST /api/structure/[code]/medical
 * Créer un événement médical. CDS et direction uniquement.
 * L'éducateur peut aussi saisir (info reçue de la colo par téléphone).
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
    allowRoles: ['direction', 'cds', 'cds_delegated', 'educateur'],
    forbiddenMessage: 'Accès réservé à la direction, au CDS et aux éducateurs.',
  });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const { inscription_id, event_type, description } = body;

  if (!inscription_id || typeof inscription_id !== 'string') {
    return NextResponse.json({ error: 'inscription_id requis.' }, { status: 400 });
  }
  if (!event_type || typeof event_type !== 'string' || event_type.trim().length < 2) {
    return NextResponse.json({ error: 'Type d\'événement requis.' }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return NextResponse.json({ error: 'Description requise (min 5 caractères).' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  // Scope ownership : éducateur/secrétariat limité à ses propres inscriptions.
  // RGPD Art.9 — un éducateur A ne doit pas créer d'event médical sur l'enfant de l'éducateur B.
  const ownership = await requireInscriptionOwnership({
    supabase,
    resolved,
    inscriptionId: inscription_id,
    structureId,
  });
  if (!ownership.ok) return ownership.response;

  const { data: event, error: insertError } = await supabase
    .from('gd_medical_events')
    .insert({
      structure_id: structureId,
      inscription_id,
      event_type: event_type.trim(),
      description: description.trim(),
      created_by: resolved.email || 'unknown',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[medical POST] error:', insertError.message);
    return NextResponse.json({ error: 'Erreur création événement médical.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'dossier_enfant',
    resourceId: event.id,
    inscriptionId: inscription_id as string,
    actorType: 'staff',
    actorId: resolved.email || undefined,
    metadata: { type: 'medical_event_created', event_type: event_type.trim(), role: resolved.role },
  });

  return NextResponse.json({ ok: true, id: event.id }, { status: 201 });
 } catch (err) {
  console.error('POST /api/structure/[code]/medical error:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
 }
}
