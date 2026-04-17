// app/api/structure/[code]/team/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code } = await params;
    const guard = await requireStructureRole(req, code, { allowRoles: ['direction', 'cds_delegated'] });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('gd_structure_access_codes')
      .select('id, email, role, active, activated_at, prenom, nom, invitation_expires_at, invited_by_email, created_at')
      .eq('structure_id', resolved.structure.id as string)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[team GET] error:', error.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }

    const now = Date.now();
    const members = (data ?? []).map((m) => ({
      id: m.id,
      email: m.email,
      role: m.role,
      prenom: m.prenom,
      nom: m.nom,
      invited_by_email: m.invited_by_email,
      created_at: m.created_at,
      activated_at: m.activated_at,
      status:
        !m.active && !m.activated_at && m.invitation_expires_at && new Date(m.invitation_expires_at).getTime() < now
          ? 'expired'
          : !m.active
          ? 'pending'
          : 'active',
    }));

    await auditLog(supabase, {
      action: 'read',
      resourceType: 'team_member',
      resourceId: resolved.structure.id as string,
      actorType: 'referent',
      actorId: resolved.email || undefined,
      ipAddress: getStructureClientIp(req),
      metadata: { type: 'team_list', actor_role: resolved.role },
    });

    return NextResponse.json({ members });
  } catch (err) {
    console.error('GET /structure/[code]/team error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
