export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { structureRateLimitGuard } from '@/lib/rate-limit-structure';

/**
 * GET /api/structure/[code]/propositions
 * Liste les propositions tarifaires reçues pour la structure (audit M3 — B2).
 *
 * Sécurité :
 *  - RLS gd_propositions_tarifaires = deny-all ; service_role bypass (ref migration 063)
 *  - Scope strict par `structure_id` via deux sources :
 *      a) inscription_id ∈ gd_inscriptions de cette structure
 *      b) demandeur_email ∈ emails rattachés (access_codes + referent inscriptions)
 *  - Éducateur = lecture restreinte à ses propres inscriptions + son email (RGPD §19)
 *  - auditLog `read` systématique (PII enfant — prénom/nom)
 *
 * Filtres optionnels query :
 *  - status=envoyee|validee|refusee|brouillon|demandee
 *  - since=30 (jours)
 *  - page=1 (défaut), limit=20 (défaut), max 100
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rateLimited = await structureRateLimitGuard(req);
  if (rateLimited) return rateLimited;

  const { code } = await params;
  // Tous les rôles structure autorisés — matrice CLAUDE.md §170 permet à tous
  // les membres de voir les propositions associées à leur structure.
  // Le scope PII pour `educateur` est appliqué plus bas (filtrage par inscriptions propres).
  const guard = await requireStructureRole(req, code, {
    excludeRoles: [], // inclure tous les rôles
  });
  if (!guard.ok) return guard.response;
  const resolved = guard.resolved;

  const supabase = getSupabaseAdmin();
  const structureId = resolved.structure.id as string;

  // ── Pagination / filtres ──
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const statusFilter = url.searchParams.get('status');
  const VALID_STATUSES = ['brouillon', 'demandee', 'envoyee', 'validee', 'refusee'];
  const statusValid = statusFilter && VALID_STATUSES.includes(statusFilter) ? statusFilter : null;

  const sinceDays = parseInt(url.searchParams.get('since') ?? '', 10);
  const sinceIso = Number.isFinite(sinceDays) && sinceDays > 0
    ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // ── Résoudre les inscriptions de la structure (scope ownership) ──
  let inscriptionsQuery = supabase
    .from('gd_inscriptions')
    .select('id, referent_email')
    .eq('structure_id', structureId);

  if (resolved.role === 'educateur' && resolved.email) {
    inscriptionsQuery = inscriptionsQuery.eq('referent_email', resolved.email);
  }

  const { data: inscriptions, error: inscError } = await inscriptionsQuery;
  if (inscError) {
    console.error('[propositions GET] inscriptions lookup failed:', inscError.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  const inscriptionIds = (inscriptions ?? []).map((i: { id: string }) => i.id);
  const structureEmails = new Set<string>();

  // Éducateur : restreindre strictement à son propre email
  if (resolved.role === 'educateur') {
    if (resolved.email) structureEmails.add(resolved.email.toLowerCase());
  } else {
    // Direction/CDS/CDS_delegated/secrétariat : accès global à la structure
    for (const i of inscriptions ?? []) {
      const ref = (i as { referent_email?: string | null }).referent_email;
      if (ref) structureEmails.add(ref.toLowerCase());
    }
    // Emails des codes d'accès (direction/cds/secretariat/educateur invités)
    const { data: codes } = await supabase
      .from('gd_structure_access_codes')
      .select('email')
      .eq('structure_id', structureId)
      .eq('active', true);
    for (const c of codes ?? []) {
      const e = (c as { email?: string | null }).email;
      if (e) structureEmails.add(e.toLowerCase());
    }
  }

  const emailList = Array.from(structureEmails);

  // Aucun identifiant → aucune proposition accessible, court-circuit.
  if (inscriptionIds.length === 0 && emailList.length === 0) {
    await auditLog(supabase, {
      action: 'read',
      resourceType: 'proposition',
      resourceId: structureId,
      actorType: 'staff',
      actorId: resolved.email || undefined,
      ipAddress: getClientIp(req),
      metadata: {
        type: 'structure_propositions_list',
        role: resolved.role,
        count: 0,
        empty: true,
      },
    });
    return NextResponse.json({ propositions: [], total: 0, page, limit });
  }

  // ── Requête principale avec OR(inscription_id ∈ …, demandeur_email ∈ …) ──
  // Supabase : `.or(...)` accepte une expression PostgREST combinée.
  const orParts: string[] = [];
  if (inscriptionIds.length > 0) {
    orParts.push(`inscription_id.in.(${inscriptionIds.join(',')})`);
  }
  if (emailList.length > 0) {
    // Échapper les virgules/parenthèses : les emails valides n'en contiennent pas,
    // mais on protège avec encodeURIComponent allégé.
    const safe = emailList
      .filter((e) => /^[^,()"\s]+$/.test(e))
      .map((e) => e);
    if (safe.length > 0) {
      orParts.push(`demandeur_email.in.(${safe.join(',')})`);
    }
  }

  let query = supabase
    .from('gd_propositions_tarifaires')
    .select(
      'id, sejour_slug, sejour_titre, enfant_prenom, enfant_nom, session_start, session_end, ville_depart, prix_total, prix_sejour, prix_transport, prix_encadrement, encadrement, status, pdf_storage_path, demandeur_email, inscription_id, created_at, updated_at, validated_at',
      { count: 'exact' }
    )
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
    .range(from, to);

  if (statusValid) query = query.eq('status', statusValid);
  if (sinceIso) query = query.gte('created_at', sinceIso);

  const { data: propositions, count, error } = await query;

  if (error) {
    console.error('[propositions GET] query error:', error.message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  // Sortie : jamais le nom complet en clair ; on expose prénom + initiale nom
  // pour alléger l'exposition PII à l'écran (cohérent avec §19 + RGPD).
  const result = (propositions ?? []).map((p: Record<string, unknown>) => {
    const nom = String(p.enfant_nom ?? '').trim();
    const nom_initiale = nom ? nom.charAt(0).toUpperCase() + '.' : '';
    return {
      id: p.id,
      sejour_slug: p.sejour_slug,
      sejour_titre: p.sejour_titre,
      enfant_prenom: p.enfant_prenom,
      enfant_nom_initiale: nom_initiale,
      session_start: p.session_start,
      session_end: p.session_end,
      ville_depart: p.ville_depart,
      prix_total: p.prix_total,
      prix_sejour: p.prix_sejour,
      prix_transport: p.prix_transport,
      prix_encadrement: p.prix_encadrement,
      encadrement: p.encadrement,
      status: p.status,
      has_pdf: Boolean(p.pdf_storage_path) || true, // PDF régénéré à la volée si pas stocké
      inscription_id: p.inscription_id,
      created_at: p.created_at,
      validated_at: p.validated_at,
      sent_at: p.status === 'envoyee' || p.status === 'validee' ? (p.updated_at ?? null) : null,
    };
  });

  await auditLog(supabase, {
    action: 'read',
    resourceType: 'proposition',
    resourceId: structureId,
    actorType: 'staff',
    actorId: resolved.email || undefined,
    ipAddress: getClientIp(req),
    metadata: {
      type: 'structure_propositions_list',
      role: resolved.role,
      count: result.length,
      total: count ?? result.length,
      filters: { status: statusValid, since_days: sinceIso ? sinceDays : null },
    },
  });

  return NextResponse.json({
    propositions: result,
    total: count ?? result.length,
    page,
    limit,
  });
}
