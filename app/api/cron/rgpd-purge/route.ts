export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

/**
 * GET /api/cron/rgpd-purge
 * Cron mensuel : purge des données RGPD expirées.
 * - Audit logs > 12 mois
 * - Données médicales > 3 mois après fin de séjour
 * Protégé par CRON_SECRET (Vercel Cron).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[rgpd-purge] CRON_SECRET non configuré — accès refusé');
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const errors: string[] = [];

  const { data: auditResult, error: errAudit } = await supabase.rpc('gd_purge_expired_audit_logs');
  if (errAudit) errors.push(`audit_logs_12m: ${errAudit.message}`);

  const { data: medicalResult, error: errMedical } = await supabase.rpc('gd_purge_expired_medical_data');
  if (errMedical) errors.push(`medical_data: ${errMedical.message}`);

  // Purge login attempts > 24h (IPs rate limiting — RGPD minimisation)
  const { data: loginResult, error: errLogin } = await supabase.rpc('purge_old_login_attempts');
  if (errLogin) errors.push(`login_attempts: ${errLogin.message}`);

  // Purge gd_medical_events > 3 mois post-séjour (Art. 9 RGPD)
  // Étape 1 : identifier les inscriptions dont la session est terminée depuis +3 mois
  // On utilise session_date + 21j (durée max séjour) comme date de fin estimée
  const purgeThreshold = new Date(Date.now() - (90 + 21) * 24 * 60 * 60 * 1000).toISOString();
  const { data: expiredEvents, error: errFetchMed } = await supabase
    .from('gd_medical_events')
    .select('id, inscription:gd_inscriptions!inner(session_date)')
    .lt('inscription.session_date', purgeThreshold);

  if (errFetchMed) {
    errors.push(`medical_events_fetch: ${errFetchMed.message}`);
  } else if (expiredEvents && expiredEvents.length > 0) {
    const idsToDelete = expiredEvents.map((e: { id: string }) => e.id);
    // Suppression par batch de 100
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100);
      const { error: errDel } = await supabase
        .from('gd_medical_events')
        .delete()
        .in('id', batch);
      if (errDel) errors.push(`medical_events_delete_batch_${i}: ${errDel.message}`);
    }
  }
  const medEventsDeleted = expiredEvents?.length ?? 0;

  // Purge tokens JWT révoqués déjà expirés (ne servent plus, RGPD minimisation)
  const { error: errRevoked } = await supabase
    .from('gd_revoked_tokens')
    .delete()
    .lt('expires_at', new Date().toISOString());
  if (errRevoked) errors.push(`revoked_tokens: ${errRevoked.message}`);

  // Purge audit logs > 3 ans (recommandation CNIL)
  const { data: auditOldResult, error: errAuditOld } = await supabase.rpc('purge_old_audit_logs');
  if (errAuditOld) errors.push(`audit_logs_3y: ${errAuditOld.message}`);

  if (errors.length > 0) {
    console.error(`[rgpd-purge] ${errors.length} erreur(s):`, errors.join('; '));
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  console.log(`[rgpd-purge] audit_logs_12m: ${auditResult ?? 0}, medical_data: ${medicalResult ?? 0}, medical_events: ${medEventsDeleted}, login_attempts: ${loginResult ?? 'ok'}, revoked_tokens: ok, audit_logs_3y: ${auditOldResult ?? 'ok'}`);

  return NextResponse.json({
    ok: true,
    purged: {
      audit_logs_12m: auditResult ?? 0,
      medical_data: medicalResult ?? 0,
      medical_events_3m: medEventsDeleted,
      login_attempts_24h: loginResult ?? 'ok',
      revoked_tokens: 'ok',
      audit_logs_3y: auditOldResult ?? 'ok',
    },
  });
}
