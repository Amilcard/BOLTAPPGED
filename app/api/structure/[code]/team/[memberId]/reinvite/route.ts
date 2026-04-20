export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';
import { generateInvitationToken, computeInvitationExpiry } from '@/lib/invitation-token';
import { sendTeamMemberInvite } from '@/lib/email';
import { UUID_RE } from '@/lib/validators';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; memberId: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
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
      .select('id, email, role, activated_at, prenom')
      .eq('id', memberId)
      .eq('structure_id', structureId)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

    if (member.activated_at) {
      return NextResponse.json(
        { error: { code: 'ALREADY_ACTIVATED', message: 'Membre déjà activé. Utilisez "révoquer" pour retirer son accès.' } },
        { status: 400 }
      );
    }

    const newToken = generateInvitationToken();
    const newExpiry = computeInvitationExpiry();

    const { error: updateErr } = await supabase
      .from('gd_structure_access_codes')
      .update({ invitation_token: newToken, invitation_expires_at: newExpiry })
      .eq('id', memberId);

    if (updateErr) {
      console.error('[reinvite] update error:', updateErr.message);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const activationUrl = `${baseUrl}/structure/activate?token=${newToken}`;

    await sendTeamMemberInvite({
      to: member.email as string,
      prenom: (member.prenom as string) || (member.email as string).split('@')[0],
      structureName: (resolved.structure.name as string) || 'votre structure',
      role: member.role as 'secretariat' | 'educateur',
      activationUrl,
      invitedBy: resolved.email || 'Direction',
    });

    await auditLog(supabase, {
      action: 'update',
      resourceType: 'team_member',
      resourceId: structureId,
      actorType: 'staff',
      actorId: resolved.email || undefined,
      ipAddress: getStructureClientIp(req),
      metadata: { type: 'team_reinvite', actor_role: resolved.role, member_email: member.email, member_role: member.role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST reinvite error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
