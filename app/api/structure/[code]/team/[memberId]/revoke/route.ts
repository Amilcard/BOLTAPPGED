export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuardStrict, getStructureClientIp } from '@/lib/rate-limit-structure';
import { UUID_RE } from '@/lib/validators';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; memberId: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuardStrict(req);
    if (rateLimited) return rateLimited;

    const { code, memberId } = await params;

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
      .select('id, email, role, last_jti, last_jti_exp')
      .eq('id', memberId)
      .eq('structure_id', structureId)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    const { error: updateErr } = await supabase
      .from('gd_structure_access_codes')
      .update({ active: false, invitation_token: null, invitation_expires_at: null, last_jti: null })
      .eq('id', memberId);

    if (updateErr) {
      console.error('[team revoke] error:', updateErr.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }

    // Révocation immédiate du JWT actif : insert dans gd_revoked_tokens
    if (member.last_jti && member.last_jti_exp) {
      const { error: revokeErr } = await supabase
        .from('gd_revoked_tokens')
        .upsert(
          { jti: member.last_jti, expires_at: member.last_jti_exp, revoked_at: new Date().toISOString() },
          { onConflict: 'jti' }
        );
      if (revokeErr) {
        console.error('[team revoke] gd_revoked_tokens insert failed:', revokeErr.message);
        // Pas bloquant : la ligne reste désactivée (active=false), même si le JWT actif reste valide 8h max
      }
    }

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'team_member',
      resourceId: structureId,
      actorType: 'staff',
      actorId: resolved.email || undefined,
      ipAddress: getStructureClientIp(req),
      metadata: {
        type: 'team_revoke',
        actor_role: resolved.role,
        member_email: member.email,
        member_role: member.role,
        jwt_revoked: !!member.last_jti,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST revoke error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
