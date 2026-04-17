export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { auditLog } from '@/lib/audit-log';
import { sendIncidentNotification } from '@/lib/email';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';

const VALID_CATEGORIES = ['medical', 'comportemental', 'fugue', 'accident', 'autre'] as const;
const VALID_SEVERITIES = ['info', 'attention', 'urgent'] as const;

/**
 * GET /api/structure/[code]/incidents
 * Liste les incidents de la structure. Tous les rôles sauf secrétariat.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rateLimited = await structureRateLimitGuard(_req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  const guard = await requireStructureRole(_req, code, { excludeRoles: ['secretariat'] });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  let query = supabase
    .from('gd_incidents')
    .select('id, inscription_id, category, severity, status, titre, description, resolved_at, resolution_note, vu_at, vu_by_code, created_by, created_at')
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
      return NextResponse.json({ incidents: [] });
    }
    query = query.in('inscription_id', ids);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[incidents GET] error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  return NextResponse.json({ incidents: data ?? [] });
}

/**
 * POST /api/structure/[code]/incidents
 * Créer un incident. Direction et CDS uniquement.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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

  const { inscription_id, category, severity, description, titre } = body;

  if (!inscription_id || typeof inscription_id !== 'string') {
    return NextResponse.json({ error: 'inscription_id requis.' }, { status: 400 });
  }
  if (!category || !VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: `Catégorie invalide. Valeurs : ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
  }
  if (!severity || !VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
    return NextResponse.json({ error: `Gravité invalide. Valeurs : ${VALID_SEVERITIES.join(', ')}` }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return NextResponse.json({ error: 'Description requise (min 5 caractères).' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  // Vérifier que l'inscription appartient à cette structure
  const { data: insc } = await supabase
    .from('gd_inscriptions')
    .select('id')
    .eq('id', inscription_id)
    .eq('structure_id', structureId)
    .is('deleted_at', null)
    .single();

  if (!insc) {
    return NextResponse.json({ error: 'Inscription introuvable dans cette structure.' }, { status: 404 });
  }

  const { data: incident, error: insertError } = await supabase
    .from('gd_incidents')
    .insert({
      structure_id: structureId,
      inscription_id,
      category,
      severity,
      titre: titre && typeof titre === 'string' ? titre.trim() : null,
      description: description.trim(),
      created_by: resolved.email || 'unknown',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[incidents POST] error:', insertError.message);
    return NextResponse.json({ error: 'Erreur création incident.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'structure',
    resourceId: incident.id,
    inscriptionId: inscription_id as string,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'incident_created', category, severity, role: resolved.role },
  });

  // Email notification si gravité >= attention
  if (severity === 'attention' || severity === 'urgent') {
    const [{ data: accessCodes }, { data: inscData }, { data: structureData }] = await Promise.all([
      supabase
        .from('gd_structure_access_codes')
        .select('email, role')
        .eq('structure_id', structureId)
        .eq('active', true)
        .in('role', ['direction', 'cds', 'cds_delegated'])
        .not('email', 'is', null),
      supabase.from('gd_inscriptions').select('jeune_prenom').eq('id', inscription_id).single(),
      // Pour urgent : inclure aussi l'email de contact principal de la structure
      severity === 'urgent'
        ? supabase.from('gd_structures').select('email').eq('id', structureId).single()
        : Promise.resolve({ data: null }),
    ]);

    const emails = new Set<string>(
      (accessCodes ?? [])
        .map((ac: { email: string | null }) => ac.email)
        .filter((e): e is string => !!e)
    );
    if (structureData?.email) emails.add(structureData.email);

    if (emails.size > 0) {
      try {
        await sendIncidentNotification([...emails], {
          structureName: (resolved.structure as { name?: string }).name || 'Structure',
          jeunePrenom: inscData?.jeune_prenom || 'Enfant',
          category: category as string,
          severity: severity as string,
          description: (description as string).trim(),
          createdBy: resolved.email || 'unknown',
        });
      } catch (emailErr) {
        console.error('[incidents POST] notification email failed:', emailErr);
      }
    }
  }

  return NextResponse.json({ ok: true, id: incident.id }, { status: 201 });
}

/**
 * PATCH /api/structure/[code]/incidents
 * Mettre à jour le statut d'un incident. Direction et CDS uniquement.
 * Body : { incident_id, status: 'ouvert' | 'en_cours' | 'resolu' }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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

  const { incident_id, status, action, resolution_note } = body;
  const VALID_STATUSES = ['ouvert', 'en_cours', 'resolu'] as const;
  const VALID_ACTIONS = ['vu'] as const;

  if (!incident_id || typeof incident_id !== 'string') {
    return NextResponse.json({ error: 'incident_id requis.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  // Action spéciale : accusé de réception (vu)
  if (action === 'vu') {
    const { error: vuError } = await supabase
      .from('gd_incidents')
      .update({ vu_at: new Date().toISOString(), vu_by_code: resolved.email || resolved.role })
      .eq('id', incident_id)
      .eq('structure_id', structureId)
      .is('vu_at', null); // Idempotent : ne pas écraser un vu existant

    if (vuError) {
      console.error('[incidents PATCH vu] error:', vuError.message);
      return NextResponse.json({ error: 'Erreur accusé réception.' }, { status: 500 });
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: incident_id,
      actorType: 'referent',
      actorId: resolved.email || undefined,
      metadata: { type: 'incident_vu', role: resolved.role },
    });

    return NextResponse.json({ ok: true, action: 'vu' });
  }

  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Action ou statut invalide. Statuts : ${VALID_STATUSES.join(', ')} — Actions : ${VALID_ACTIONS.join(', ')}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'resolu') {
    updateData.resolved_at = new Date().toISOString();
    if (resolution_note && typeof resolution_note === 'string') {
      updateData.resolution_note = resolution_note.trim();
    }
  } else {
    updateData.resolved_at = null;
  }

  const { error: updateError } = await supabase
    .from('gd_incidents')
    .update(updateData)
    .eq('id', incident_id)
    .eq('structure_id', structureId);

  if (updateError) {
    console.error('[incidents PATCH] error:', updateError.message);
    return NextResponse.json({ error: 'Erreur mise à jour incident.' }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'update',
    resourceType: 'structure',
    resourceId: incident_id as string,
    actorType: 'referent',
    actorId: resolved.email || undefined,
    metadata: { type: 'incident_status_change', new_status: status, role: resolved.role },
  });

  return NextResponse.json({ ok: true, status });
}
