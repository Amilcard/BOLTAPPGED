export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { enrichInscriptions, type InscriptionRaw } from '@/lib/inscription-enrichment';
import { auditLog } from '@/lib/audit-log';

// Rate limiting : 10 tentatives / 15 min par IP (anti brute-force)
const STRUCT_MAX_ATTEMPTS = 10;
const STRUCT_WINDOW_MINUTES = 15;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function isStructureRateLimited(ip: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const windowStart = new Date(now.getTime() - STRUCT_WINDOW_MINUTES * 60 * 1000);

    const { data: entry } = await supabase
      .from('gd_login_attempts')
      .select('attempt_count, window_start')
      .eq('ip', `struct:${ip}`)
      .single();

    if (!entry || new Date(entry.window_start) < windowStart) {
      await supabase
        .from('gd_login_attempts')
        .upsert(
          { ip: `struct:${ip}`, attempt_count: 1, window_start: now.toISOString() },
          { onConflict: 'ip' }
        );
      return false;
    }

    if (entry.attempt_count >= STRUCT_MAX_ATTEMPTS) {
      return true;
    }

    await supabase
      .from('gd_login_attempts')
      .update({ attempt_count: entry.attempt_count + 1 })
      .eq('ip', `struct:${ip}`);

    return false;
  } catch {
    return false; // fail-open
  }
}

/**
 * Détecte le rôle en fonction du code fourni.
 * - 6 chars → CDS (code structure existant)
 * - 10 chars → Directeur (code_directeur)
 *
 * L'éducateur utilise le suivi_token par inscription (pas cette route).
 */
type StructureRole = 'cds' | 'directeur';

async function resolveCodeToStructure(
  code: string
): Promise<{ structure: Record<string, unknown>; role: StructureRole } | null> {
  const supabase = getSupabase();
  const codeNorm = code.toUpperCase();
  const now = new Date().toISOString();

  // Essai code CDS (6 chars)
  if (codeNorm.length === 6) {
    const { data } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type, email, code_expires_at, code_revoked_at')
      .eq('code', codeNorm)
      .eq('status', 'active')
      .single();

    if (!data) return null;

    // Vérifier expiration et révocation
    if (data.code_revoked_at) return null;
    if (data.code_expires_at && data.code_expires_at < now) return null;

    return { structure: data, role: 'cds' };
  }

  // Essai code Directeur (10 chars)
  if (codeNorm.length === 10) {
    const { data } = await supabase
      .from('gd_structures')
      .select('id, name, city, postal_code, type, email, code_directeur_expires_at, code_directeur_revoked_at')
      .eq('code_directeur', codeNorm)
      .eq('status', 'active')
      .single();

    if (!data) return null;

    if (data.code_directeur_revoked_at) return null;
    if (data.code_directeur_expires_at && data.code_directeur_expires_at < now) return null;

    return { structure: data, role: 'directeur' };
  }

  return null;
}

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
  const { code } = await params;

  // Validation format : 6 ou 10 chars alphanum
  if (!code || !/^[A-Z0-9]{6}$/i.test(code) && !/^[A-Z0-9]{10}$/i.test(code)) {
    return NextResponse.json(
      { error: { code: 'INVALID_CODE', message: 'Format de code invalide.' } },
      { status: 400 }
    );
  }

  // Rate limiting anti brute-force
  const ip = getClientIp(_req);
  if (await isStructureRateLimited(ip)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans quelques minutes.' } },
      { status: 429 }
    );
  }

  // Résolution code → structure + rôle
  const resolved = await resolveCodeToStructure(code);
  if (!resolved) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Code invalide, expiré ou révoqué.' } },
      { status: 404 }
    );
  }

  const { structure, role } = resolved;
  const supabase = getSupabase();
  const structureId = structure.id as string;

  // Audit log — RGPD : tracer chaque accès aux données enfants
  auditLog(supabase, {
    action: 'read',
    resourceType: 'inscription',
    resourceId: structureId,
    actorType: 'referent',
    metadata: { access_type: 'structure_code', role, ip, code_length: code.length },
  });

  // Récupérer les inscriptions rattachées
  const { data: inscriptions, error: inscErr } = await supabase
    .from('gd_inscriptions')
    .select(
      '*, gd_dossier_enfant(bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, ged_sent_at), gd_stays!fk_inscriptions_stay(marketing_title, title)'
    )
    .eq('structure_id', structureId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (inscErr) {
    console.error('[api/structure/[code]] inscriptions error:', inscErr);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }

  // Enrichir (logique partagée avec /api/admin/inscriptions)
  const enriched = enrichInscriptions((inscriptions || []) as InscriptionRaw[]);

  return NextResponse.json({
    structure: {
      id: structureId,
      name: structure.name,
      city: structure.city,
      postalCode: structure.postal_code,
      type: structure.type,
      email: structure.email,
    },
    role,
    inscriptions: enriched,
  });
}
