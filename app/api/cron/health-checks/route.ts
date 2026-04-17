export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { errorResponse, unauthorizedResponse } from '@/lib/auth-middleware';

/**
 * GET /api/cron/health-checks
 * Cron quotidien (6h UTC) — HC-1→HC-5 (GOVERNANCE.md).
 * Retourne 200 + rapport JSON si tout est sain.
 * Retourne 500 si au moins une alerte détectée → Vercel Cron relance.
 *
 * HC-1 : séjours publiés sans sessions ou sans prix
 * HC-2 : orphelins référentiels (v_orphaned_records)
 * HC-3 : inscriptions avec statut inconnu
 * HC-4 : données médicales hors délai RGPD (> 111 jours)
 * HC-5 : codes access_codes actifs mais expirés (cron expire-codes KO)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[health-checks] CRON_SECRET non configuré');
    return errorResponse('CONFIG_ERROR', 'CRON_SECRET manquant.', 500);
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return unauthorizedResponse();
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const alerts: string[] = [];

  // ── HC-1 : intégrité 3 couches séjours publiés ────────────────────────────
  let hc1Count = 0;
  try {
    const { data: publishedStays } = await supabase
      .from('gd_stays')
      .select('slug')
      .eq('published', true);

    const { data: staysWithSessions } = await supabase
      .from('gd_stay_sessions')
      .select('stay_slug');

    const { data: staysWithPrices } = await supabase
      .from('gd_session_prices')
      .select('stay_slug');

    const slugsWithSessions = new Set((staysWithSessions ?? []).map((s) => s.stay_slug));
    const slugsWithPrices = new Set((staysWithPrices ?? []).map((s) => s.stay_slug));

    const violations = (publishedStays ?? []).filter(
      (s) => !slugsWithSessions.has(s.slug) || !slugsWithPrices.has(s.slug)
    );
    hc1Count = violations.length;
    if (hc1Count > 0) {
      alerts.push(`HC-1: ${hc1Count} séjour(s) publié(s) sans sessions ou sans prix`);
      console.warn('[health-checks] HC-1 ALERTE', violations.map((s) => s.slug));
    }
  } catch (e) {
    alerts.push('HC-1: erreur requête');
    console.error('[health-checks] HC-1 erreur', e);
  }

  // ── HC-2 : orphelins référentiels ─────────────────────────────────────────
  let hc2Count = 0;
  try {
    const { data: orphans, error } = await supabase
      .from('v_orphaned_records')
      .select('*')
      .limit(20);

    if (error) throw error;
    hc2Count = orphans?.length ?? 0;
    if (hc2Count > 0) {
      alerts.push(`HC-2: ${hc2Count} orphelin(s) référentiel(s) détecté(s)`);
      console.warn('[health-checks] HC-2 ALERTE', orphans);
    }
  } catch (e) {
    alerts.push('HC-2: erreur requête');
    console.error('[health-checks] HC-2 erreur', e);
  }

  // ── HC-3 : inscriptions avec statut inconnu ───────────────────────────────
  let hc3Count = 0;
  const validStatuses = [
    'pending', 'paid', 'failed', 'cancelled',
    'validee', 'refusee', 'en_attente_paiement', 'amount_mismatch', 'en_attente',
  ];
  try {
    const { data: inscriptions } = await supabase
      .from('gd_inscriptions')
      .select('id, status')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    const violations = (inscriptions ?? []).filter((i) => !validStatuses.includes(i.status));
    hc3Count = violations.length;
    if (hc3Count > 0) {
      alerts.push(`HC-3: ${hc3Count} inscription(s) avec statut inconnu`);
      console.warn('[health-checks] HC-3 ALERTE', violations.map((i) => ({ id: i.id, status: i.status })));
    }
  } catch (e) {
    alerts.push('HC-3: erreur requête');
    console.error('[health-checks] HC-3 erreur', e);
  }

  // ── HC-4 : données médicales hors délai RGPD ──────────────────────────────
  let hc4Count = 0;
  try {
    const cutoff = new Date(Date.now() - 111 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('gd_medical_events')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoff);

    if (error) throw error;
    hc4Count = count ?? 0;
    if (hc4Count > 0) {
      alerts.push(`HC-4: ${hc4Count} événement(s) médical(aux) à purger (> 111 jours)`);
      console.warn('[health-checks] HC-4 ALERTE — relancer /api/cron/rgpd-purge');
    }
  } catch (e) {
    alerts.push('HC-4: erreur requête');
    console.error('[health-checks] HC-4 erreur', e);
  }

  // ── HC-5 : codes actifs mais expirés (cron expire-codes KO) ──────────────
  let hc5Count = 0;
  try {
    const { data: expiredCodes, error } = await supabase
      .from('gd_structure_access_codes')
      .select('id, expires_at')
      .lt('expires_at', now)
      .eq('active', true);

    if (error) throw error;
    hc5Count = expiredCodes?.length ?? 0;
    if (hc5Count > 0) {
      alerts.push(`HC-5: ${hc5Count} code(s) expiré(s) encore actif(s) — cron expire-codes KO`);
      console.warn('[health-checks] HC-5 ALERTE', hc5Count, 'codes actifs expirés');
    }
  } catch (e) {
    alerts.push('HC-5: erreur requête');
    console.error('[health-checks] HC-5 erreur', e);
  }

  // ── Résultat ──────────────────────────────────────────────────────────────
  const ok = alerts.length === 0;
  const report = {
    ok,
    run_at: now,
    checks: { hc1: hc1Count, hc2: hc2Count, hc3: hc3Count, hc4: hc4Count, hc5: hc5Count },
    alerts,
  };

  console.log('[health-checks]', ok ? 'ALL OK' : `${alerts.length} ALERTE(S)`, report.checks);

  return NextResponse.json(report, { status: ok ? 200 : 500 });
}
