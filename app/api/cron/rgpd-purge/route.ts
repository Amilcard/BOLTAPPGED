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

  // Purge audit logs > 3 ans (recommandation CNIL)
  const { data: auditOldResult, error: errAuditOld } = await supabase.rpc('purge_old_audit_logs');
  if (errAuditOld) errors.push(`audit_logs_3y: ${errAuditOld.message}`);

  if (errors.length > 0) {
    console.error(`[rgpd-purge] ${errors.length} erreur(s):`, errors.join('; '));
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  console.log(`[rgpd-purge] audit_logs_12m: ${auditResult ?? 0}, medical_data: ${medicalResult ?? 0}, login_attempts: ${loginResult ?? 'ok'}, audit_logs_3y: ${auditOldResult ?? 'ok'}`);

  return NextResponse.json({
    ok: true,
    purged: {
      audit_logs_12m: auditResult ?? 0,
      medical_data: medicalResult ?? 0,
      login_attempts_24h: loginResult ?? 'ok',
      audit_logs_3y: auditOldResult ?? 'ok',
    },
  });
}
