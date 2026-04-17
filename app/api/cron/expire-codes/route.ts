export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';

/**
 * GET /api/cron/expire-codes
 * Cron quotidien (2h UTC) : révoque les codes structures expirés.
 * - Codes CDS expirés (code_expires_at < NOW)
 * - Codes Directeur expirés (code_directeur_expires_at < NOW)
 * Protégé par CRON_SECRET (Vercel Cron).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[expire-codes] CRON_SECRET non configuré — accès refusé');
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Révoquer les codes CDS expirés
  const { data: revokedCds, error: errCds } = await supabase
    .from('gd_structures')
    .update({ code_revoked_at: now })
    .lt('code_expires_at', now)
    .is('code_revoked_at', null)
    .eq('status', 'active')
    .select('id');

  if (errCds) {
    console.error('[expire-codes] Erreur révocation codes CDS:', errCds.message);
  }

  // Révoquer les codes Directeur expirés
  const { data: revokedDir, error: errDir } = await supabase
    .from('gd_structures')
    .update({ code_directeur_revoked_at: now })
    .lt('code_directeur_expires_at', now)
    .is('code_directeur_revoked_at', null)
    .eq('status', 'active')
    .select('id');

  if (errDir) {
    console.error('[expire-codes] Erreur révocation codes Directeur:', errDir.message);
  }

  // Désactiver les codes gd_structure_access_codes expirés (migration 042+)
  const { data: revokedAccess, error: errAccess } = await supabase
    .from('gd_structure_access_codes')
    .update({ active: false })
    .lt('expires_at', now)
    .eq('active', true)
    .select('id');

  if (errAccess) {
    console.error('[expire-codes] Erreur désactivation gd_structure_access_codes:', errAccess.message);
  }

  const countCds = revokedCds?.length ?? 0;
  const countDir = revokedDir?.length ?? 0;
  const countAccess = revokedAccess?.length ?? 0;

  console.log(`[expire-codes] codes CDS révoqués: ${countCds}, codes Directeur révoqués: ${countDir}, access_codes désactivés: ${countAccess}`);

  // Audit log — tracer les révocations réussies même en cas d'erreur partielle
  if (countCds + countDir + countAccess > 0) {
    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: 'system',
      actorType: 'system',
      metadata: {
        type: 'code_expiration_cron',
        revoked_cds: countCds,
        revoked_directeur: countDir,
        revoked_access: countAccess,
        run_at: now,
      },
    });
  }

  // Si erreur DB sur l'un ou l'autre → 500 pour retry Vercel Cron (après audit log)
  if (errCds || errDir || errAccess) {
    return NextResponse.json(
      {
        ok: false,
        errors: {
          cds: errCds?.message ?? null,
          directeur: errDir?.message ?? null,
          access: errAccess?.message ?? null,
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    revoked: {
      cds: countCds,
      directeur: countDir,
      access: countAccess,
    },
  });
}
