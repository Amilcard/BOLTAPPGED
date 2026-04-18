export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { enrichInscriptions, type InscriptionRaw } from '@/lib/inscription-enrichment';
import { auditLog } from '@/lib/audit-log';
import { resolveCodeToStructure } from '@/lib/structure';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';

// resolveCodeToStructure et StructureRole déplacés vers @/lib/structure

/**
 * GET /api/structure/[code]
 *
 * Accès par code structure (CDS 6 chars ou Directeur 10 chars).
 * Retourne les infos de la structure + inscriptions rattachées.
 * RGPD : rate limited + audit log sur chaque accès.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
 try {
  const { code } = await params;

  // Validation format : 6 ou 10 chars alphanum
  if (!code || (!/^[A-Z0-9]{6}$/i.test(code) && !/^[A-Z0-9]{10}$/i.test(code))) {
    return NextResponse.json(
      { error: { code: 'INVALID_CODE', message: 'Format de code invalide.' } },
      { status: 400 }
    );
  }

  // Rate limiting anti brute-force
  const rateLimited = await structureRateLimitGuard(_req);
  if (rateLimited) return rateLimited;

  // Résolution code → structure + rôle
  const resolved = await resolveCodeToStructure(code);
  if (!resolved) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Code invalide, expiré ou révoqué.' } },
      { status: 404 }
    );
  }

  const { structure, role, roles, email: accessEmail } = resolved;
  const supabase = getSupabaseAdmin();
  const structureId = structure.id as string;

  // Audit log — RGPD : tracer chaque accès aux données enfants
  await auditLog(supabase, {
    action: 'read',
    resourceType: 'inscription',
    resourceId: structureId,
    actorType: 'referent',
    metadata: { access_type: 'structure_code', role, roles, ip: getStructureClientIp(_req), code_length: code.length },
  });

  // Récupérer les inscriptions rattachées
  let query = supabase
    .from('gd_inscriptions')
    .select(
      'id, jeune_prenom, jeune_nom, jeune_date_naissance, referent_nom, referent_email, sejour_slug, session_id, status, payment_status, payment_method, price_total, dossier_ref, created_at, suivi_token, structure_id, gd_dossier_enfant(bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, ged_sent_at), gd_stays!fk_inscriptions_stay(marketing_title, title)'
    )
    .eq('structure_id', structureId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // ISOLATION ÉDUCATEUR : ne voit que ses propres inscriptions
  if (role === 'educateur') {
    if (!accessEmail) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Accès refusé : email requis pour le rôle éducateur.' } },
        { status: 403 }
      );
    }
    query = query.eq('referent_email', accessEmail);
  }

  const { data: inscriptions, error: inscErr } = await query;

  if (inscErr) {
    console.error('[api/structure/[code]] inscriptions error:', inscErr);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }

  // Enrichir (logique partagée avec /api/admin/inscriptions)
  const enriched = enrichInscriptions((inscriptions || []) as InscriptionRaw[]);

  // Lookup session_end_date (join gd_stay_sessions par slug + start_date)
  const sessionDates = enriched.map(i => ({ slug: i.sejour_slug, start: (i as Record<string, unknown>).session_date })).filter(s => s.slug && s.start);
  if (sessionDates.length > 0) {
    const { data: sessions } = await supabase
      .from('gd_stay_sessions')
      .select('stay_slug, start_date, end_date')
      .in('stay_slug', [...new Set(sessionDates.map(s => s.slug))]);
    if (sessions) {
      const sessionMap = new Map(sessions.map(s => [`${s.stay_slug}|${s.start_date}`, s.end_date]));
      enriched.forEach((ins: Record<string, unknown>) => {
        const key = `${ins.sejour_slug}|${ins.session_date}`;
        ins.session_end_date = sessionMap.get(key) || null;
      });
    }
  }

  const s = structure as Record<string, unknown>;
  const showCodes = role === 'direction' || role === 'cds_delegated';

  // Vérifier si la structure utilise le nouveau système de codes (gd_structure_access_codes)
  const { count: migratedCount } = await supabase
    .from('gd_structure_access_codes')
    .select('id', { count: 'exact', head: true })
    .eq('structure_id', structureId);
  const isMigrated = (migratedCount ?? 0) > 0;

  // Souhaits enfants rattachés à la structure (parcours kids→pro)
  const { data: souhaits } = await supabase
    .from('gd_souhaits')
    .select('id, kid_prenom, sejour_titre, motivation, status, created_at')
    .eq('structure_id', structureId)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    souhaits: souhaits || [],
    structure: {
      id: structureId,
      name: s.name,
      city: s.city,
      postalCode: s.postal_code,
      type: s.type,
      email: s.email,
      code: showCodes ? s.code : undefined,
      rgpdAcceptedAt: s.rgpd_accepted_at || null,
      delegationFrom: s.delegation_active_from || null,
      delegationUntil: s.delegation_active_until || null,
      delegatedToEmail: s.delegated_to_email || null,
      isMigrated,
    },
    role,
    roles,
    accessEmail,
    inscriptions: enriched,
  });
 } catch (err) {
  console.error('GET /api/structure/[code] error:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
 }
}

/**
 * POST /api/structure/[code]
 * Accepter l'engagement RGPD pour la structure.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
 try {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: { code: 'MISSING_CODE' } }, { status: 400 });
  }

  // Rate limiting anti brute-force (même guard que GET)
  const rateLimitedPost = await structureRateLimitGuard(_req);
  if (rateLimitedPost) return rateLimitedPost;

  const supabase = getSupabaseAdmin();
  const codeNorm = code.toUpperCase();

  // Résolution via resolveCodeToStructure (gd_structure_access_codes en priorité, fallback legacy)
  const resolved = await resolveCodeToStructure(codeNorm);
  if (!resolved) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  // Récupérer rgpd_accepted_at depuis gd_structures — vérifier status = active
  const { data: structure } = await supabase
    .from('gd_structures')
    .select('id, rgpd_accepted_at')
    .eq('id', resolved.structure.id)
    .eq('status', 'active')
    .single();

  if (!structure) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  // Déjà accepté
  if (structure.rgpd_accepted_at) {
    return NextResponse.json({ already: true, acceptedAt: structure.rgpd_accepted_at });
  }

  // Enregistrer l'acceptation
  const { error } = await supabase
    .from('gd_structures')
    .update({
      rgpd_accepted_at: new Date().toISOString(),
      rgpd_accepted_by: codeNorm,
    })
    .eq('id', structure.id);

  if (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }

  await auditLog(supabase, {
    action: 'create',
    resourceType: 'structure',
    resourceId: structure.id,
    actorType: 'referent',
    actorId: resolved.email || codeNorm,
    metadata: {
      type: 'rgpd_consent',
      code_used: codeNorm,
      role: resolved.role,
      structure_name: resolved.structure.name,
    },
  });

  return NextResponse.json({ accepted: true, acceptedAt: new Date().toISOString() });
 } catch (err) {
  console.error('POST /api/structure/[code] error:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } }, { status: 500 });
 }
}
