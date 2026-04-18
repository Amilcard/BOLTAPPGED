export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { auditLog } from '@/lib/audit-log';

/**
 * GET /api/cron/cleanup-invitations
 * Cron quotidien 3h30 UTC : supprime les invitations pending expirées depuis >48h.
 * Critère : active=false ET activated_at IS NULL ET invitation_expires_at < NOW() - 48h ET email IS NOT NULL.
 * Protège les codes CDS/direction legacy (email NULL).
 * Trace auditLog par run (pas par ligne) pour minimiser le volume.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cleanup-invitations] CRON_SECRET manquant');
    return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('gd_structure_access_codes')
    .delete()
    .eq('active', false)
    .is('activated_at', null)
    .lt('invitation_expires_at', cutoff)
    .not('email', 'is', null)
    .select('id, structure_id');

  if (error) {
    console.error('[cleanup-invitations] DELETE error:', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    await auditLog(supabase, {
      action: 'delete',
      resourceType: 'team_member',
      resourceId: 'system',
      actorType: 'system',
      metadata: {
        type: 'cleanup_expired_invitations',
        count,
        cutoff,
      },
    });
  }

  console.log(`[cleanup-invitations] Purged ${count} expired invitations`);
  return NextResponse.json({ ok: true, deleted: count });
}
