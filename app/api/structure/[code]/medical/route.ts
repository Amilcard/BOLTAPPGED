export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { resolveCodeToStructure } from '@/lib/structure';
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
  const rateLimited = await structureRateLimitGuard(_req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const resolved = await resolveCodeToStructure(code);
  if (!resolved || resolved.role === 'secretariat') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const supabase = getSupabase();
  const structureId = resolved.structure.id as string;

  // Éducateur : compteur uniquement (RGPD — pas de détail médical)
  if (resolved.role === 'educateur') {
    const { count, error } = await supabase
      .from('gd_medical_events')
      .select('id', { count: 'exact', head: true })
      .eq('structure_id', structureId);

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
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'medical_events_read', role: resolved.role, count: data?.length ?? 0 },
  });

  return NextResponse.json({ count: data?.length ?? 0, detail: data ?? [] });
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
  const rateLimited = await structureRateLimitGuard(req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const resolved = await resolveCodeToStructure(code);
  if (!resolved || resolved.role === 'secretariat') {
    return NextResponse.json({ error: 'Accès réservé à la direction, au CDS et aux éducateurs.' }, { status: 403 });
  }

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

  const supabase = getSupabase();
  const structureId = resolved.structure.id as string;

  // Vérifier que l'inscription appartient à cette structure
  const { data: insc } = await supabase
    .from('gd_inscriptions')
    .select('id')
    .eq('id', inscription_id)
    .eq('structure_id', structureId)
    .single();

  if (!insc) {
    return NextResponse.json({ error: 'Inscription introuvable dans cette structure.' }, { status: 404 });
  }

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
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'medical_event_created', event_type: event_type.trim(), role: resolved.role },
  });

  return NextResponse.json({ ok: true, id: event.id }, { status: 201 });
}
