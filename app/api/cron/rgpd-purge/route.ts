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

  const { data: auditResult } = await supabase.rpc('gd_purge_expired_audit_logs');
  const { data: medicalResult } = await supabase.rpc('gd_purge_expired_medical_data');

  console.log(`[rgpd-purge] audit_logs: ${auditResult ?? 0}, medical_data: ${medicalResult ?? 0}`);

  return NextResponse.json({
    ok: true,
    purged: {
      audit_logs: auditResult ?? 0,
      medical_data: medicalResult ?? 0,
    },
  });
}
