export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
import { enrichInscriptions, type InscriptionRaw } from '@/lib/inscription-enrichment';

// Rate limiting : 10 tentatives / 15 min par IP (anti brute-force code 6 chars)
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
 * GET /api/structure/[code]
 *
 * Accès public — le code 6 caractères fait office de token (même principe que /suivi/[token]).
 * Retourne les infos de la structure + toutes les inscriptions rattachées.
 * RGPD : rate limited pour empêcher le brute-force (10 req / 15 min par IP).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || !/^[A-Z0-9]{6}$/i.test(code)) {
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

  const codeNorm = code.toUpperCase();
  const supabase = getSupabase();

  // 1. Récupérer la structure
  const { data: structure, error: structErr } = await supabase
    .from('gd_structures')
    .select('id, name, city, postal_code, type, email')
    .eq('code', codeNorm)
    .eq('status', 'active')
    .single();

  if (structErr || !structure) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Code structure invalide ou structure inactive.' } },
      { status: 404 }
    );
  }

  // 2. Récupérer les inscriptions rattachées
  const { data: inscriptions, error: inscErr } = await supabase
    .from('gd_inscriptions')
    .select(
      '*, gd_dossier_enfant(bulletin_completed, sanitaire_completed, liaison_completed, renseignements_completed, documents_joints, ged_sent_at), gd_stays!fk_inscriptions_stay(marketing_title, title)'
    )
    .eq('structure_id', structure.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (inscErr) {
    console.error('[api/structure/[code]] inscriptions error:', inscErr);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }

  // 3. Enrichir (logique partagée avec /api/admin/inscriptions)
  const enriched = enrichInscriptions((inscriptions || []) as InscriptionRaw[]);

  return NextResponse.json({
    structure: {
      id: structure.id,
      name: structure.name,
      city: structure.city,
      postalCode: structure.postal_code,
      type: structure.type,
      email: structure.email,
      code: codeNorm,
    },
    inscriptions: enriched,
  });
}
