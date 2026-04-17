// app/api/structure/[code]/invite/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireStructureRole } from '@/lib/structure-guard';
import { auditLog } from '@/lib/audit-log';
import { structureRateLimitGuard, getStructureClientIp } from '@/lib/rate-limit-structure';
import { generateInvitationToken, computeInvitationExpiry } from '@/lib/invitation-token';
import { sendTeamMemberInvite } from '@/lib/email';

const VALID_ROLES = ['secretariat', 'educateur'] as const;
type InviteRole = typeof VALID_ROLES[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimited = await structureRateLimitGuard(req);
    if (rateLimited) return rateLimited;

    const { code } = await params;
    if (!code || !/^[A-Z0-9]{10}$/i.test(code)) {
      return NextResponse.json({ error: { code: 'INVALID_CODE', message: 'Code directeur requis.' } }, { status: 400 });
    }

    const guard = await requireStructureRole(req, code, {
      allowRoles: ['direction'],
      forbiddenMessage: 'Accès réservé au directeur.',
    });
    if (!guard.ok) return guard.response;
    const resolved = guard.resolved;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: { code: 'INVALID_BODY' } }, { status: 400 });

    const { email, role, prenom, nom } = body as { email?: string; role?: string; prenom?: string; nom?: string };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return NextResponse.json({ error: { code: 'INVALID_EMAIL', message: 'Email valide requis.' } }, { status: 400 });
    }
    if (!role || !VALID_ROLES.includes(role as InviteRole)) {
      return NextResponse.json({ error: { code: 'INVALID_ROLE', message: `Rôle doit être : ${VALID_ROLES.join(', ')}.` } }, { status: 400 });
    }

    const emailNorm = email.trim().toLowerCase();
    const structureId = resolved.structure.id as string;
    const supabase = getSupabaseAdmin();

    // Vérifier doublon
    const { data: existing } = await supabase
      .from('gd_structure_access_codes')
      .select('id')
      .eq('structure_id', structureId)
      .eq('email', emailNorm)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: { code: 'ALREADY_INVITED', message: 'Cet email est déjà invité sur cette structure.' } },
        { status: 409 }
      );
    }

    const invitationToken = generateInvitationToken();
    const invitationExpiresAt = computeInvitationExpiry();

    // Génération d'un code personnel 8 chars (distinct du code structure) — crypto-secure
    const { randomInt } = await import('crypto');
    const CHARSET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
    const personalCode = Array.from({ length: 8 }, () =>
      CHARSET.charAt(randomInt(0, CHARSET.length))
    ).join('');

    const { data: inserted, error: insertErr } = await supabase
      .from('gd_structure_access_codes')
      .insert({
        structure_id: structureId,
        code: personalCode,
        role,
        email: emailNorm,
        prenom: prenom?.trim() || null,
        nom: nom?.trim() || null,
        active: false,
        invitation_token: invitationToken,
        invitation_expires_at: invitationExpiresAt,
        invited_by_email: resolved.email || 'direction-code',
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      // Violation UNIQUE (structure_id, email) → 409 explicite
      if (insertErr?.code === '23505') {
        return NextResponse.json(
          { error: { code: 'ALREADY_INVITED', message: 'Cet email est déjà invité sur cette structure.' } },
          { status: 409 }
        );
      }
      console.error('[invite] insert error:', insertErr?.message);
      return NextResponse.json({ error: { code: 'INSERT_ERROR' } }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const activationUrl = `${baseUrl}/structure/activate?token=${invitationToken}`;

    const emailResult = await sendTeamMemberInvite({
      to: emailNorm,
      prenom: prenom?.trim() || emailNorm.split('@')[0],
      structureName: (resolved.structure.name as string) || 'votre structure',
      role: role as InviteRole,
      activationUrl,
      invitedBy: resolved.email || 'Direction',
    });
    const emailSent = emailResult !== null;

    await auditLog(supabase, {
      action: 'create',
      resourceType: 'structure',
      resourceId: structureId,
      actorType: 'referent',
      actorId: resolved.email || `direction-code:${code.slice(0, 4)}…`,
      ipAddress: getStructureClientIp(req),
      metadata: { type: 'team_invite', actor_role: resolved.role, invited_email: emailNorm, role, email_sent: emailSent },
    });

    return NextResponse.json({ ok: true, memberId: inserted.id, emailSent }, { status: 201 });
  } catch (err) {
    console.error('POST /structure/[code]/invite error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
