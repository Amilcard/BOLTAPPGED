export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; memberId: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code, memberId } = await params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(memberId)) {
      return NextResponse.json({ error: { code: 'INVALID_ID' } }, { status: 400 });
    }

    const guard = await requireStructureRole(req, code, { allowRoles: ['direction'] });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    const supabase = getSupabaseAdmin();
    const structureId = resolved.structure.id as string;

    const { data: member } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role')
      .eq('id', memberId)
      .eq('structure_id', structureId)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    const { error: updateErr } = await supabase
      .from('gd_structure_access_codes')
      .update({ active: false, invitation_token: null, invitation_expires_at: null })
      .eq('id', memberId);

    if (updateErr) {
      console.error('[team revoke] error:', updateErr.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'structure',
      resourceId: structureId,
      actorType: 'referent',
      actorId: resolved.email || undefined,
      ipAddress: getStructureClientIp(req),
      metadata: { type: 'team_revoke', actor_role: resolved.role, member_email: member.email, member_role: member.role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST revoke error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
